/** Stop accepting requests, let active work finish, then bound lingering HTTP/TLS connections. */
export async function closeStudioServer(server,{graceMs=10000}={}) {
  let timer;
  try {
    await new Promise((resolve,reject)=>{
      timer=setTimeout(()=>server.closeAllConnections(),graceMs);timer.unref?.();
      server.close(error=>error&&error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):resolve());
      server.closeIdleConnections();
    });
  } finally {clearTimeout(timer);}
}
