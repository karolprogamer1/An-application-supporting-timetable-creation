-- Zwiększa długość kolumny 'haslo' w tabeli 'uzytkownicy' do 255 znaków.
-- Jest to konieczne do przechowywania hashy haseł (np. bcrypt), które mają 60 znaków.
-- Poprawia to błąd "wartość zbyt długa dla typu znakowego zmiennego (50)"
-- występujący przy tworzeniu nowego studenta/użytkownika.

ALTER TABLE uzytkownicy ALTER COLUMN haslo TYPE VARCHAR(255);