const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '5mb' }));
app.get('/', (req, res) => res.status(200).send('ok'));
app.get('/healthz', (req, res) => res.status(200).send('ok'));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function appendToCSV(filename, headers, row) {
  const filePath = path.join(DATA_DIR, filename);
  const exists = fs.existsSync(filePath);
  const csvRow = headers.map(h => (row[h] !== undefined ? row[h] : '')).join(',') + '\n';
  if (!exists) fs.writeFileSync(filePath, headers.join(',') + '\n');
  fs.appendFileSync(filePath, csvRow);
}
const API_KEY = process.env.API_KEY || ''; // set this in the cloud
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/save') {
    if (!API_KEY) return res.status(500).send('Server API key not set');
    if (req.headers['x-api-key'] !== API_KEY) return res.status(401).send('Unauthorized');
  }
  next();
});

app.post('/save', (req, res) => {
  const { participant_id, data_type, data } = req.body;

  if (!participant_id || !data_type || !data) {
    return res.status(400).send('Missing fields');
  }

  if (data_type === 'trial') {
    const headers = [
      'participant','age','gender','main','block','block_type','scenario',
      'trial_global','trial_in_scenario','left_dot_count','right_dot_count',
      'correct_side','response','correct','response_time','initial_confidence',
      'confidence_rt','partner_response','partner_confidence','partner_agreed',
      'decision','decision_rt','final_confidence','final_confidence_rt',
      'conf_update','change','button_location','dot_delta','new_delta',
      'recent_performance','cumulative_accuracy','reversal_count',
      'consecutive_correct','consecutive_incorrect'
    ];
    appendToCSV(`participant_${participant_id}_dots.csv`, headers, data);
  }

  if (data_type === 'scenario') {
    const headers = ['participant','block','block_type','scenario','scenario_response'];
    appendToCSV(`participant_${participant_id}_scenarios.csv`, headers, data);
  }

  if (data_type === 'completion') {
    fs.appendFileSync(path.join(DATA_DIR, 'completion_log.txt'), JSON.stringify(req.body) + '\n');
  }

  res.send('Saved');
});

// Require API key for file listing/downloading
function requireApiKey(req, res, next) {
  if (!API_KEY) return res.status(500).send('Server API key not set');
  // Allow header OR query param for convenience
  const keyFromHeader = req.headers['x-api-key'];
  const keyFromQuery  = req.query.key;
  if (keyFromHeader === API_KEY || keyFromQuery === API_KEY) return next();
  return res.status(401).send('Unauthorized');
}

app.get('/files', requireApiKey, (req, res) => {
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
  const links = files.map(file => `<li><a href="/files/${encodeURIComponent(file)}?key=${encodeURIComponent(API_KEY)}">${file}</a></li>`).join('');
  res.send(`
    <html>
      <head><title>Available Files</title></head>
      <body>
        <h2>Available Files</h2>
        <ul>${links}</ul>
      </body>
    </html>
  `);
});

app.get('/files/:name', requireApiKey, (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.name);
  if (!fs.existsSync(filePath)) return res.status(404).send('Not found');
  res.download(filePath);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));

