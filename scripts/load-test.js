(async () => {
  const requests = [];
  for (let i = 1; i <= 30; i++) {
    requests.push(
      fetch('http://localhost:3000/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: `t${i}@example.com`, subject: `Load ${i}`, message: 'x' }),
      })
    );
  }
  await Promise.all(requests);
  console.log('Sent 30 requests');
})();