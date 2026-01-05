const { google } = require('googleapis');
const keys = require('../../service-account.json');
const spreadsheetId = process.env.SPREADSHEET_ID;

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const auth = new google.auth.JWT({
  email: keys.client_email,
  key: keys.private_key.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});
const sheets = google.sheets({ version: 'v4', auth });

async function getAllMasters(req, res) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Masters!A2:D',
    });

    const rows = response.data.values || [];

    const masters = rows
      .map(row => ({
        id: (row[0] || '').trim(),
        name: (row[1] || '').trim(),
        serviceIds: (row[2] || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        telegramId: (row[3] || '').trim() || null,
      }))
      .filter(master => master.id && master.id !== '0');

    res.json(masters);
  } catch (err) {
    console.error('❌ Ошибка при получении мастеров:', err.response?.data || err);
    res.status(500).json({ error: 'Ошибка при получении мастеров' });
  }
}

module.exports = { getAllMasters };
