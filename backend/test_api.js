const time = "10:30";
const body = {
  name: 'Test Customer',
  time: time,
  serviceId: 'cmu918a9g000aoizcs0rcku6x', // Corte tradicional
  barberId: 'cmu9189zk0005oizcz9v823iz' // Marcos
};

fetch('http://localhost:3333/api/appointments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(console.log)
.catch(console.error);
