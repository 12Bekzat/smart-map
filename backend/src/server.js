import 'dotenv/config';
import { app } from './app.js';

const port = Number(process.env.PORT || 4000);

const server = app.listen(port, () => {
  console.log(`SafeWay API listening on http://localhost:${port}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the old backend process or set another PORT in backend/.env.`);
    console.error(`Windows: Get-NetTCPConnection -LocalPort ${port} | Select-Object OwningProcess`);
    process.exit(1);
  }

  throw error;
});
