const { google } = require('googleapis');
const keys = require('../../service-account.json');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'Услуги';

const client = new google.auth.JWT({
  email: keys.client_email,
  key: keys.private_key.replace(/\\n/g, '\n'),
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth: client });

const getServicesByMaster = async (req, res) => {
  const { masterId } = req.params;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:G100`,
    });

    const rows = response.data.values || [];
    const services = rows
      .filter(row => {
        const masterIds = row[4]
          ?.split(',')
          .map(id => id.replace(/\s/g, ''));
        return masterIds?.includes(masterId.toString());
      })
      .map(row => ({
        id: row[0],
        name: row[1],
        duration: row[2],
        price: row[3],
      }));

    res.json(services);
  } catch (err) {
    console.error('❌ Ошибка при получении услуг для мастера:', err);
    res.status(500).json({ error: 'Ошибка при получении услуг' });
  }
};

module.exports = { getServicesByMaster };
