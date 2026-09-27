import React from 'react';

const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    // Próba formatowania daty, z obsługą nieprawidłowych formatów
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (e) {
    console.error("Invalid date format:", dateString);
    return dateString; // Zwróć oryginalny string w razie błędu
  }
};

export default function GeneratedScheduleView({ plan }) {
  if (!plan || plan.length === 0) {
    return <p>Brak wygenerowanego planu do wyświetlenia.</p>;
  }

  return (
    <div className="schedule-container">
      {/* To jest przykład. Dostosuj do swojej aktualnej struktury tabeli/listy */}
      <table className="schedule-table">
        <thead>
          <tr>
            <th>Dzień</th>
            <th>Godziny</th>
            <th>Zajęcia</th>
            {/* ... Inne nagłówki ... */}
          </tr>
        </thead>
        <tbody>
          {plan.map((item, index) => (
            <tr key={index}>
              <td>{item.day}</td>
              <td>{item.time}</td>
              <td>
                {item.name}
                {(item.data_rozpoczecia || item.data_zakonczenia) && (
                  <div style={{ color: 'red', fontSize: '0.9em', marginTop: '5px' }}>
                    Okres: {formatDate(item.data_rozpoczecia) || '?'} - {formatDate(item.data_zakonczenia) || '?'}
                  </div>
                )}
              </td>
              {/* ... Pozostałe komórki (wykładowca, sala, etc.) ... */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}