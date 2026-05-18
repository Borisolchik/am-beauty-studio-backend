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
    if (err.response) {
      console.error('❌ Telegram API error:', err.response.data);
    } else {
      console.error('❌ Telegram send error:', err.message);
    }
  }
}

const auth = new google.auth.JWT({
  email: keys.client_email,
  key: keys.private_key.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({
  version: 'v4',
  auth,
});

const getSlotsByMaster = async (req, res) => {
  const { masterName } = req.params;
  const { slotsRequired = 1 } = req.query;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${masterName}!A2:F`,
    });

    const rows = response.data.values || [];

    const availableSlots = rows.filter(
      row => row[3] === 'available'
    );

    const filteredSlots = [];

    for (let i = 0; i < availableSlots.length; i++) {
      const current = availableSlots[i];

      if (Number(slotsRequired) === 1) {
        filteredSlots.push(current);
        continue;
      }

      const next = availableSlots[i + 1];

      if (
        next &&
        current[0] === next[0]
      ) {
        filteredSlots.push(current);
      }
    }

    const slots = filteredSlots.map(row => ({
      date: row[0],
      time: row[1],
      service: row[2],
    }));

    res.json(slots);

  } catch (err) {
    console.error('❌ Ошибка при получении слотов:', err);
    res.status(500).json({
      error: 'Ошибка при получении слотов'
    });
  }
};

const createBooking = async (req, res) => {
  const {
    masterName,
    date,
    time,
    service,
    client,
    phone,
    slotsRequired = 1
  } = req.body;

  if (
    !masterName ||
    !date ||
    !time ||
    !service ||
    !client ||
    !phone
  ) {
    return res.status(400).json({
      error: 'Все поля обязательны'
    });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${masterName}!A2:F`,
    });

    const rows = response.data.values || [];

    const startIndex = rows.findIndex(
      row =>
        row[0] === date &&
        row[1] === time &&
        row[3] === 'available'
    );

    if (startIndex === -1) {
      return res.status(400).json({
        error: 'Слот недоступен'
      });
    }

    if (Number(slotsRequired) === 2) {
      const next = rows[startIndex + 1];

      if (
        !next ||
        next[0] !== date ||
        next[3] !== 'available'
      ) {
        return res.status(400).json({
          error: 'Нет второго окна'
        });
      }
    }

    rows[startIndex][3] = 'booked';
    rows[startIndex][4] = client;
    rows[startIndex][5] = `'${phone}`;

    if (Number(slotsRequired) === 2) {
      rows[startIndex + 1][3] = 'booked';
      rows[startIndex + 1][4] = client;
      rows[startIndex + 1][5] = `'${phone}`;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${masterName}!A2:F`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    const mastersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Masters!A2:D',
    });

    const masterRows = mastersResponse.data.values || [];

    const masterRow = masterRows.find(
      row => row[1] === masterName
    );

    const telegramId = masterRow?.[3];

    if (telegramId) {
      await sendTelegramMessage(
        telegramId,
        `Новая запись ✅
Имя клиента: ${client}
Процедура: ${service}
Дата: ${date}
Время: ${time}
Телефон: ${phone}`
      );
    }

    res.json({
      message: '✅ Запись успешно забронирована!'
    });

  } catch (err) {
    console.error('❌ Ошибка при бронировании:', err);

    res.status(500).json({
      error: 'Ошибка при бронировании'
    });
  }
};

module.exports = {
  getSlotsByMaster,
  createBooking,
};