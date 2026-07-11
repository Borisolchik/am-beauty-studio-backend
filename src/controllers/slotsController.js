const { google } = require('googleapis');
const axios = require('axios');

const keys = JSON.parse(process.env.GCP_SERVICE_ACCOUNT || "{}");
const spreadsheetId = process.env.SPREADSHEET_ID;

const TELEGRAM_BOT_TOKEN = '8138897961:AAE8IJFmAX1vDl3mO408zDxZYu0CTkbfNOY';

async function sendTelegramMessage(chatId, text) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text,
      }
    );
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

const auth = new google.auth.JWT({
  email: keys.client_email,
  key: keys.private_key.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};

const STEP = 120;

const generateCancelCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const getSlotsByMaster = async (req, res) => {
  const { masterName } = req.params;
  const slotsRequired = Number(req.query.slotsRequired || 1);

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${masterName}!A2:G`,
    });

    const rows = response.data.values || [];

    const slots = rows.map(r => ({
      date: r[0],
      time: r[1],
      status: r[3],
    }));

    const available = slots.filter(s => s.status === 'available');

    available.sort((a, b) =>
      a.date.localeCompare(b.date) ||
      toMinutes(a.time) - toMinutes(b.time)
    );

    const result = [];

    for (let i = 0; i < available.length; i++) {
      const current = available[i];

      if (slotsRequired === 1) {
        result.push(current);
        continue;
      }

      let ok = true;
      let prev = toMinutes(current.time);

      for (let j = 1; j < slotsRequired; j++) {
        const next = available[i + j];

        if (!next || next.date !== current.date) {
          ok = false;
          break;
        }

        const nextTime = toMinutes(next.time);

        if (next.status !== 'available' || nextTime - prev !== STEP) {
          ok = false;
          break;
        }

        prev = nextTime;
      }

      if (ok) result.push(current);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Ошибка при получении слотов' });
  }
};

const createBooking = async (req, res) => {
  const { masterName, date, time, service, client, phone, slotsRequired = 1 } = req.body;

  if (!masterName || !date || !time || !service || !client || !phone) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${masterName}!A2:G`,
    });

    const rows = response.data.values || [];

    const startIndex = rows.findIndex(
      r => r[0] === date && r[1] === time && r[3] === 'available'
    );

    if (startIndex === -1) {
      return res.status(400).json({ error: 'Слот недоступен' });
    }

    if (slotsRequired > 1) {
      let prev = toMinutes(rows[startIndex][1]);

      for (let i = 1; i < slotsRequired; i++) {
        const next = rows[startIndex + i];

        if (!next || next[0] !== date || next[3] !== 'available') {
          return res.status(400).json({ error: 'Нет полного окна' });
        }

        const nextTime = toMinutes(next[1]);

        if (nextTime - prev !== STEP) {
          return res.status(400).json({ error: 'Слоты не подряд' });
        }

        prev = nextTime;
      }
    }

    const cancelCode = generateCancelCode();

    for (let i = 0; i < slotsRequired; i++) {
      rows[startIndex + i][2] = service;
      rows[startIndex + i][3] = 'booked';
      rows[startIndex + i][4] = client;
      rows[startIndex + i][5] = `'${phone}`;
      rows[startIndex + i][6] = cancelCode;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${masterName}!A2:G`,
      valueInputOption: 'RAW',
      requestBody: { values: rows },
    });

    const mastersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Masters!A2:D',
    });

    const masterRows = mastersResponse.data.values || [];
    const master = masterRows.find(r => r[1] === masterName);
    const telegramId = master?.[3];

    if (telegramId) {
      await sendTelegramMessage(
        telegramId,
        `Новая запись\n${client}\n${service}\n${date}\n${time}\n${phone}`
      );
    }

    res.json({
      message: 'OK',
      cancelCode,
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка' });
  }
};

const normalizePhone = (phone) => {
  return String(phone || '').replace(/\D/g, '');
};

const findBooking = async (req, res) => {
  const { phone, cancelCode } = req.body;

  if (!phone || !cancelCode) {
    return res.status(400).json({
      error: 'Телефон и код обязательны'
    });
  }

  try {
    const mastersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Masters!A2:D',
    });

    const masterRows = mastersResponse.data.values || [];

    for (const masterRow of masterRows) {
      const masterName = masterRow[1];

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${masterName}!A2:G`,
      });

      const rows = response.data.values || [];

      const booking = rows.find(row =>
        row[3] === 'booked' &&
        normalizePhone(row[5]) === normalizePhone(phone) &&
        String(row[6]) === String(cancelCode)
      );

      if (booking) {
        return res.json({
          found: true,
          booking: {
            masterName,
            date: booking[0],
            time: booking[1],
            service: booking[2],
            client: booking[4],
          }
        });
      }
    }

    return res.json({
      found: false
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Ошибка поиска записи'
    });
  }
};

module.exports = {
  getSlotsByMaster,
  createBooking,
  findBooking,
};