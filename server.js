
const express=require('express');
const sqlite3=require('sqlite3').verbose();
const bodyParser=require('body-parser');
const app=express();
app.use(bodyParser.json());
app.use(express.static(__dirname));

const db=new sqlite3.Database('./db/finance.db');
db.serialize(()=>{
db.run('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE,password TEXT)');
db.run('CREATE TABLE IF NOT EXISTS accounts(id INTEGER PRIMARY KEY,user_id INTEGER,name TEXT,type TEXT)');
db.run('CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,user_id INTEGER,name TEXT)');
db.run('CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY,user_id INTEGER,trtype TEXT,from_acc TEXT,to_acc TEXT,amount REAL,remarks TEXT,dt DATETIME DEFAULT CURRENT_TIMESTAMP)');
});

app.post('/register',(req,res)=>{
db.run('INSERT INTO users(username,password) VALUES(?,?)',[req.body.username,req.body.password],e=>{
if(e)return res.status(400).send(e.message);
res.send('ok');
});
});

app.post('/login',(req,res)=>{
db.get('SELECT * FROM users WHERE username=? AND password=?',[req.body.username,req.body.password],(e,row)=>{
if(row) res.json(row); else res.status(401).send('invalid');
});
});

app.listen(3000);
console.log('http://localhost:3000');
