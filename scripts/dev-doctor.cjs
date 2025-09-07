#!/usr/bin/env node
const fs=require('fs');const {execSync}=require('child_process');

const MOBILE_DIR=process.env.MOBILE_DIR||'atlas-mobile';
const ok=s=>console.log('✅',s); const warn=s=>console.log('⚠️',s); const err=s=>console.error('❌',s);

try{
  if(fs.existsSync('.env')) ok('.env found');
  else if(fs.existsSync('.env.example')) warn('.env missing (you have .env.example)');
  else warn('No .env or .env.example');

  if(fs.existsSync('vite.config.ts')||fs.existsSync('vite.config.js')) ok('Web project (Vite) detected at repo root');

  if(fs.existsSync(`${MOBILE_DIR}/package.json`)) ok(`Mobile project detected at ./${MOBILE_DIR}`);
  else warn(`Mobile project not found at ./${MOBILE_DIR} (set MOBILE_DIR env if different)`);

  const checkPort=(port)=>{ try{
    execSync(`node -e "require('net').createServer().once('error',()=>process.exit(0)).once('listening',function(){this.close();process.exit(1)}).listen(${port})"`);
    ok(`Port ${port} seems free`);
  }catch{ warn(`Port ${port} is busy (service may already be running)`); } };

  checkPort(5173);  // Vite
  checkPort(19000); // Expo

  console.log('\nTip: run `npm run dev:web` and `npm run dev:mobile` in separate terminals (or `npm run dev:all`).');
}catch(e){ err(e.message); process.exit(1); }
