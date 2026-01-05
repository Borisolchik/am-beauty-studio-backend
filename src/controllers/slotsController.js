const { google } = require('googleapis');
const keys = require('../../service-account.json');
const spreadsheetId = process.env.SPREADSHEET_ID;

const axios = require('axios');

const TELEGRAM_BOT_TOKEN = '8138897961:AAE8IJFmAX1vDl3mO408zDxZYu0CTkbfNOY';

async function sendTelegramMessage(chatId, text) {
  try {
    const response = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: chatId,
        text: text,
      }
    );
  } catch (err) {
    if (err.response) {
      console.error('❌ Telegram API вернул ошибку:', err.response.data);
    } else {
      console.error('❌ Ошибка отправки Telegram уведомления:', err.message);
    }
  }
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const auth = new google.auth.JWT({
  email: keys.client_email,
  key: keys.private_key.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});
const sheets = google.sheets({ version: 'v4', auth });

const getSlotsByMaster = async (req, res) => {
  const { masterName } = req.params;
  const { service } = req.query;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${masterName}!A2:F`,
    });

    const rows = response.data.values || [];
    const slots = rows
      .filter(row => row[3] === 'available')
      .map(row => ({
        date: row[0],
        time: row[1],
        service: row[2],
      }));

    res.json(slots);
  } catch (err) {
    console.error('❌ Ошибка при получении слотов:', err);
    res.status(500).json({ error: 'Ошибка при получении слотов' });
  }
};

const createBooking = async (req, res) => {
  const { masterName, date, time, service, client, phone } = req.body;
  if (!masterName || !date || !time || !service || !client || !phone) {
    console.warn('⚠ Не все поля заполнены');
    return res.status(400).json({ error: 'Все поля обязательны' });
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${masterName}!A2:F`,
    });

    const rows = response.data.values || [];

    let slotFound = false;
    const updatedRows = rows.map(row => {
      if (row[0] === date && row[1] === time && row[3] === 'available') {
        slotFound = true;
        return [date, time, service, 'booked', client, `'${phone}`];
      }
      return row;
    });

    if (!slotFound) {
      console.warn('⚠ Слот недоступен или уже забронирован');
      return res.status(400).json({ error: 'Слот недоступен или уже забронирован' });
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${masterName}!A2:F`,
      valueInputOption: 'RAW',
      requestBody: { values: updatedRows },
    });

    const mastersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Masters!A2:D',
    });

    const masterRows = mastersResponse.data.values || [];
    const masterRow = masterRows.find(row => row[1] === masterName);
    const telegramId = masterRow ? masterRow[3] : null;

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
    } else {
      console.warn('⚠ Telegram ID не найден, уведомление не отправлено');
    }

    res.json({ message: '✅ Запись успешно забронирована!' });
  } catch (err) {
    console.error('❌ Ошибка при бронировании:', err);
    res.status(500).json({ error: 'Ошибка при бронировании' });
  }
};

module.exports = { getSlotsByMaster, createBooking };
