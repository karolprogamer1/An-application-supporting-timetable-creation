const fetch = global.fetch;
(async () => {
  try {
    const subjectResponse = await fetch('http://127.0.0.1:5000/api/przedmiot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wykladowca_id: 1, nazwa: 'Testowy przedmiot', typ: 'Wykład', ilosc_godz: 30 }),
    });
    console.log('subject status', subjectResponse.status);
    console.log('subject body', await subjectResponse.text());

    const classResponse = await fetch('http://127.0.0.1:5000/api/zajecia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ przedmiot_id: 1, typ: 'wykład', czas: '09:00' }),
    });
    console.log('class status', classResponse.status);
    console.log('class body', await classResponse.text());
  } catch (err) {
    console.error(err);
  }
})();
