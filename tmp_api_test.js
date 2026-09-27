const fetch = global.fetch;
(async () => {
  try {
    const lecturerResponse = await fetch('http://127.0.0.1:5000/api/wykladowca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uzytkownicy_id: 1, imie: 'Test', nazwisko: 'Testowy', tytul_naukowy: 'Dr' }),
    });
    console.log('lecturer status', lecturerResponse.status);
    console.log('lecturer body', await lecturerResponse.text());

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
