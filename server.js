
const express = require('express');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'server-data.json');

const seeds = {
  students: require('./src/data/students.json'),
  groups: require('./src/data/groups.json'),
  awards: require('./src/data/awards.json'),
  badges: require('./src/data/badges.json'),
  teachers: require('./src/data/teachers.json'),
};

let data = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  : seeds;

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const app = express();
app.use(express.json());

app.get('/api/:resource', (req, res) => {
  const resource = req.params.resource;
  if (!(resource in data)) {
    return res.status(404).end();
  }
  res.json(data[resource]);
});

app.post('/api/:resource', (req, res) => {
  const resource = req.params.resource;
  if (!(resource in data)) {
    return res.status(404).end();
  }
  data[resource] = req.body;
  save();
  res.json({ ok: true });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);

});
