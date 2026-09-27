// ViewPlan.jsx (poprawiony)
import { useState, useMemo, useEffect, useRef } from 'react'
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  normalizeSpecializationValue,
  isGeneralSpecialization,
  normalizeStudyMode,
  getPlannerSemesters,
  planVariantMatchesSelectedSpecialization,
  courseMatchesSelectedSpecialization,
  resolveSemesterFilterValue,
} from './planFilters.js';

// Rozszerzona mapa dni (uwzględnia różne warianty)
const dayMap = {
  'poniedziałek': 'monday',
  'poniedzialek': 'monday',
  'monday': 'monday',
  'wtorek': 'tuesday',
  'tuesday': 'tuesday',
  'środa': 'wednesday',
  'sroda': 'wednesday',
  'wednesday': 'wednesday',
  'czwartek': 'thursday',
  'thursday': 'thursday',
  'piątek': 'friday',
  'piatek': 'friday',
  'friday': 'friday',
  'sobota': 'saturday',
  'saturday': 'saturday',
  'niedziela': 'sunday',
  'sunday': 'sunday',
}

const fullTimeDaysOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
const partTimeDaysOrder = ['friday', 'saturday', 'sunday'];
const dayLabels = {
  monday: 'Poniedziałek',
  tuesday: 'Wtorek',
  wednesday: 'Środa',
  thursday: 'Czwartek',
  friday: 'Piątek',
  saturday: 'Sobota',
  sunday: 'Niedziela',
}

const formatDate = (dateString) => {
  if (!dateString) return null;
  try {
    // Próba formatowania daty, z obsługą nieprawidłowych formatów
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    console.error("Invalid date format:", dateString);
    return dateString; // Zwróć oryginalny string w razie błędu
  }
};

const formatTime = (minutes) => {
  if (minutes == null || Number.isNaN(minutes)) return '';
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const getSemesterNumbers = (s) => {
  if (s == null) return [];
  let str = String(s).trim().toLowerCase();

  const romanMap = {
    'i': '1', 'ii': '2', 'iii': '3', 'iv': '4', 'v': '5',
    'vi': '6', 'vii': '7', 'viii': '8', 'ix': '9', 'x': '10'
  };
  const semesterRegex = /(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)/g;

  // Case 1: "semestr X/Y" format, which means year X, semester Y. This is a single semester.
  const yearSemMatch = str.match(/semestr\s*(\d+)\s*\/\s*(\d+)/);
  if (yearSemMatch) {
    const semester = yearSemMatch[2]; // The second number is the semester
    if (Number(semester) > 0 && Number(semester) <= 12) {
        return [String(semester)];
    }
  }
  
  if (str.includes('rok') && !/semestr|sem\./.test(str)) {
    return [];
  }

  if (/semestr|sem\./.test(str)) {
    str = str.replace(/rok\s*(\d+|i{1,3}|iv|v|vi|vii|viii|ix|x)/g, '');
  }
  
  const matches = str.match(semesterRegex);

  if (!matches) return [];

  const semesterNumbers = matches.map(match => {
    if (romanMap[match]) {
      return romanMap[match];
    }
    const num = Number(match);
    if (num > 0 && num <= 12) return String(num);
    return null;
  }).filter(Boolean);

  return [...new Set(semesterNumbers)];
};

const getHeaderText = (semester, specializationAbbrev = '') => {
  if (!semester) {
    return 'Plan zajęć'; // Fallback
  }

  const semesterPart = String(semester).split('|')[0].trim();
  if (!semesterPart || isNaN(Number(semesterPart))) {
    return 'Plan zajęć';
  }

  const sem = Number(semesterPart);
  const year = Math.ceil(sem / 2);
  const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V' };
  const romanYear = romanMap[year] || year;
  return `${romanYear} rok, ${sem} semestr Informatyka${specializationAbbrev ? ` ${specializationAbbrev}` : ''}`;
};

const ScheduleGrid = ({ schedule, studyMode }) => {
  const daysOrder = (studyMode === 'STAC' || studyMode === 'ST') ? fullTimeDaysOrder : partTimeDaysOrder;

  const dayColumnMinWidth = useMemo(() => {
    const widths = {};
    const sequences = {};
    daysOrder.forEach((day) => {
      widths[day] = undefined;
      sequences[day] = { current: 0, prevEndRow: 0, max: 0 };
    });

    schedule.forEach((row, rowIndex) => {
      daysOrder.forEach((day) => {
        const cell = row[day];
        if (!cell || cell.covered) return;

        if (Array.isArray(cell.items) && cell.items.length >= 3) {
          widths[day] = '280px';
        }

        const seq = sequences[day];
        const startRow = rowIndex;
        const endRow = rowIndex + (cell.rowSpan || 1);

        if (startRow === seq.prevEndRow || startRow === seq.prevEndRow + 1) {
          seq.current += 1;
        } else {
          seq.current = 1;
        }
        seq.prevEndRow = endRow;
        if (seq.current > seq.max) seq.max = seq.current;
      });
    });

    daysOrder.forEach((day) => {
      if (sequences[day].max >= 3) {
        widths[day] = '280px';
      }
    });

    return widths;
  }, [schedule, daysOrder]);

  return (
    <div className="schedule-wrapper" style={{ ['--slot-height']: '32px' }}>
      <table className="schedule-table">
        <thead>
          <tr>
            <th style={{ minWidth: '80px' }}>Godzina</th>
            {daysOrder.map(day => (<th key={day} style={dayColumnMinWidth[day] ? { minWidth: dayColumnMinWidth[day], width: dayColumnMinWidth[day] } : {}}>{dayLabels[day]}</th>))}
          </tr>
        </thead>
        <tbody>
          {(schedule || []).map((row) => (
            <tr key={row.time}>
              <td className="time-cell">{row.time.slice(0, 5)}</td>
              {daysOrder.map(day => {
                const cellData = row[day];
                if (!cellData || cellData.covered) {
                  return null;
                }
                return (
                  <td
                    key={day}
                    className="plan-cell"
                    rowSpan={cellData.rowSpan || 1}
                    style={dayColumnMinWidth[day] ? { minWidth: dayColumnMinWidth[day], width: dayColumnMinWidth[day] } : undefined}
                  >
                    {cellData.items.length > 0 ? (
                      <div className="plan-cell-content" style={{ '--plan-columns': cellData.items.length, display: 'grid', gridTemplateColumns: `repeat(${cellData.items.length}, minmax(0, 1fr))`, gap: '8px', alignItems: 'stretch' }}>
                        {cellData.items.map((item, itemIdx) => {
                          const durationRowSpan = item.durationRowSpan || item.rowSpan;
                          const blockStyle = {
                            alignSelf: 'start',
                            height: `calc(${durationRowSpan} * var(--slot-height))`,
                            minHeight: `calc(${durationRowSpan} * var(--slot-height))`,
                            flex: '1 1 0',
                            minWidth: 0,
                          };
                          return (
                            <div key={itemIdx} className={`plan-block plan-block--${item.planType}`} style={blockStyle}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div className="plan-block-title" title={item.fullName || item.name}>{item.name}</div>
                                {item.group ? (<div className="group-badge">gr. {item.group}</div>) : null}
                              </div>
                              {item.start && item.end && (<div className="time-label">{item.start} — {item.end}</div>)}
                              {item.details && (<div className="plan-block-details">{item.details}</div>)}
                              {(item.data_rozpoczecia || item.data_zakonczenia) && (
                                <div style={{ color: 'red', fontSize: '0.9em', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                                  Okres: {formatDate(item.data_rozpoczecia) || '?'} - {formatDate(item.data_zakonczenia) || '?'}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const buildExportTitle = ({ semester, studyMode, specialization, group, selectedPlanLabel }) => {
  const parts = [];
  if (selectedPlanLabel && selectedPlanLabel !== 'Plan') {
    parts.push(selectedPlanLabel);
  }
  if (semester) {
    parts.push(`Semestr ${semester}`);
  }
  if (studyMode) {
    parts.push(`Tryb ${studyMode}`);
  }
  if (specialization && specialization !== 'all' && specialization !== 'Wszystkie') {
    parts.push(`Specjalność ${specialization}`);
  }
  if (group && group !== 'all') {
    parts.push(`Grupa ${group}`);
  }
  return parts.length > 0 ? `Plan zajęć — ${parts.join(' • ')}` : 'Plan zajęć';
};

const escapeXml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const getExcelColumnName = (columnNumber) => {
  let value = columnNumber;
  let columnName = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    value = Math.floor((value - 1) / 26);
  }
  return columnName;
};

const getExportShapeLines = (item) => {
  const lines = [{ text: item.fullName || item.name || 'Zajęcia', bold: true, size: 1200, color: 'FFFFFF' }];
  if (item.group) lines.push({ text: `Grupa: ${item.group}`, bold: true, size: 1050, color: '009FE3' });
  if (item.type) lines.push({ text: item.type, size: 1050, color: 'FFFFFF' });
  if (item.lecturer) lines.push({ text: item.lecturer, size: 1050, color: 'FFFFFF' });
  if (item.start && item.end) lines.push({ text: `godz. ${item.start} — ${item.end}`, bold: true, size: 1050, color: 'FF0000' });
  if (item.room) lines.push({ text: `s. ${item.room}`, bold: true, size: 1050, color: 'FFFFFF' });
  if (item.specjalnosc) lines.push({ text: item.specjalnosc, bold: true, size: 950, color: 'FF00FF' });
  if (item.data_rozpoczecia || item.data_zakonczenia) {
    lines.push({ text: `Okres: ${formatDate(item.data_rozpoczecia) || '?'} - ${formatDate(item.data_zakonczenia) || '?'}`, size: 950, color: 'FFFFFF' });
  }
  return lines;
};

const addRectangleShapesToWorkbook = async (xlsxBuffer, shapes) => {
  if (shapes.length === 0) return xlsxBuffer;

  const zip = await JSZip.loadAsync(xlsxBuffer);
  const sheetPath = 'xl/worksheets/sheet1.xml';
  const sheetRelsPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  const drawingPath = 'xl/drawings/drawing1.xml';
  let sheetXml = await zip.file(sheetPath).async('string');
  let sheetRelsXml = zip.file(sheetRelsPath)
    ? await zip.file(sheetRelsPath).async('string')
    : '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
  const relationshipIds = [...sheetRelsXml.matchAll(/Id="rId(\d+)"/g)].map((match) => Number(match[1]));
  const drawingRelationshipId = `rId${Math.max(0, ...relationshipIds) + 1}`;

  // Figury nie mogą pozostawiać pod sobą widocznych komórek pomocniczych.
  // Usuwamy je tylko z kopii XLSX zawierającej warstwę rysunków; oryginalny
  // bufor zachowuje komórkowy wariant awaryjny na wypadek błędu eksportu.
  const coveredCells = new Set();
  shapes.forEach(({ columnIndex, rowIndex, rowSpan }) => {
    for (let offset = 0; offset < rowSpan; offset += 1) {
      coveredCells.add(`${getExcelColumnName(columnIndex)}${rowIndex + offset + 3}`);
    }
  });
  coveredCells.forEach((cellReference) => {
    const escapedReference = cellReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cellPattern = new RegExp(`<c r="${escapedReference}"[^>]*(?:/>|>[\\s\\S]*?<\\/c>)`, 'g');
    sheetXml = sheetXml.replace(cellPattern, '');
  });

  const anchors = shapes.map((shape, index) => {
    const paragraphs = getExportShapeLines(shape.item).map((line) => (
      `<a:p><a:pPr algn="l"/><a:r><a:rPr lang="pl-PL" sz="${line.size}"${line.bold ? ' b="1"' : ''}><a:solidFill><a:srgbClr val="${line.color}"/></a:solidFill></a:rPr><a:t>${escapeXml(line.text)}</a:t></a:r><a:endParaRPr lang="pl-PL"/></a:p>`
    )).join('');
    const fromRow = shape.rowIndex + 2;
    const toRow = fromRow + shape.rowSpan;
    const fromColumn = shape.columnIndex - 1;
    const toColumn = fromColumn + 1;
    return `<xdr:twoCellAnchor editAs="twoCell"><xdr:from><xdr:col>${fromColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${toColumn}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:sp><xdr:nvSpPr><xdr:cNvPr id="${index + 1}" name="Zajęcia ${index + 1}"/><xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="1E88E5"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="0D47A1"/></a:solidFill></a:ln></xdr:spPr><xdr:txBody><a:bodyPr wrap="square" lIns="45720" rIns="45720" tIns="22860" bIns="22860"><a:normAutofit fontScale="80000" lnSpcReduction="0"/></a:bodyPr><a:lstStyle/>${paragraphs}</xdr:txBody></xdr:sp><xdr:clientData/></xdr:twoCellAnchor>`;
  }).join('');
  const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors}</xdr:wsDr>`;

  sheetRelsXml = sheetRelsXml.replace('</Relationships>', `<Relationship Id="${drawingRelationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>`);
  sheetXml = sheetXml.replace('</worksheet>', `<drawing r:id="${drawingRelationshipId}"/></worksheet>`);
  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  contentTypesXml = contentTypesXml.replace('</Types>', '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');

  zip.file(sheetPath, sheetXml);
  zip.file(sheetRelsPath, sheetRelsXml);
  zip.file(drawingPath, drawingXml);
  zip.file('[Content_Types].xml', contentTypesXml);
  return zip.generateAsync({ type: 'arraybuffer' });
};

const handleExportToExcel = async (scheduleData, daysOrder, dayLabelsMap, group, semester, customFileName, exportMeta) => {
  if (!scheduleData || scheduleData.length === 0) {
    alert("Brak danych do wyeksportowania.");
    return;
  }

  const gridBorder = {
    top: { style: 'dotted', color: { argb: 'FF9E9E9E' } },
    bottom: { style: 'dotted', color: { argb: 'FF9E9E9E' } },
    left: { style: 'dotted', color: { argb: 'FF9E9E9E' } },
    right: { style: 'dotted', color: { argb: 'FF9E9E9E' } },
  };
  const blockBorder = {
    top: { style: 'thin', color: { argb: 'FF000000' } },
    bottom: { style: 'thin', color: { argb: 'FF000000' } },
    left: { style: 'thin', color: { argb: 'FF000000' } },
    right: { style: 'thin', color: { argb: 'FF000000' } },
  };
  const headerStyle = {
    font: { bold: true, color: { argb: 'FF000000' }, size: 11 },
    alignment: { vertical: 'middle', horizontal: 'center', wrapText: true },
    border: blockBorder,
  };
  const timeCellStyle = {
    font: { bold: true, size: 10, color: { argb: 'FF000000' } },
    alignment: { vertical: 'middle', horizontal: 'center' },
    border: blockBorder,
  };

  const getCellContent = (cellData) => {
    if (!cellData?.items?.length) return { value: '', lineCount: 0 };

    const richText = [];
    let lineCount = 0;
    cellData.items.forEach((item, itemIndex) => {
      // `name` jest skrócone tylko na potrzeby widoku planu. W eksporcie
      // zawsze używamy pełnej nazwy, aby nie pozostawiać wielokropków.
      const titleLine = item.fullName || item.name || 'Zajęcia';
      const addLine = (text, font) => {
        richText.push({ text: `${text}\n`, font });
        // Szerokość pasa bloku to ok. 26 znaków. Uwzględnienie zawijania
        // pozwala dobrać prawidłową wysokość także dla krótkich zajęć.
        lineCount += Math.max(1, Math.ceil(String(text).length / 26));
      };
      if (itemIndex > 0) {
        richText.push({ text: '\n' });
        lineCount += 1;
      }

      addLine(titleLine, { bold: true, size: 10, color: { argb: 'FFFFFFFF' } });
      if (item.group) addLine(`Grupa: ${item.group}`, { bold: true, size: 9, color: { argb: 'FF009FE3' } });
      if (item.type) addLine(item.type, { size: 9, color: { argb: 'FFFFFFFF' } });
      if (item.lecturer) addLine(item.lecturer, { size: 9, color: { argb: 'FFFFFFFF' } });
      if (item.start && item.end) addLine(`godz. ${item.start} — ${item.end}`, { bold: true, size: 9, color: { argb: 'FFFF0000' } });
      if (item.room) addLine(`s. ${item.room}`, { bold: true, size: 9, color: { argb: 'FFFFFFFF' } });
      if (item.specjalnosc) addLine(item.specjalnosc, { bold: true, size: 8, color: { argb: 'FFFF00FF' } });

      if (item.data_rozpoczecia || item.data_zakonczenia) {
        addLine(`Okres: ${formatDate(item.data_rozpoczecia) || '?'} - ${formatDate(item.data_zakonczenia) || '?'}`, { size: 8, color: { argb: 'FFFFFFFF' } });
      }
    });
    return { value: { richText }, lineCount };
  };

  const getClassStyle = (items = []) => {
    return {
      font: { bold: false, size: 10, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E88E5' } },
      alignment: { wrapText: true, vertical: 'top', horizontal: 'left' },
      border: blockBorder,
    };
  };

  // Przydziel równoległe zajęcia do osobnych pasów w obrębie tego samego dnia.
  // Każdy pas jest osobną kolumną, a więc również osobnym prostokątem w Excelu.
  const dayLayouts = daysOrder.map((day) => {
    const laneEnds = [];
    const placements = [];
    scheduleData.forEach((row, rowIndex) => {
      (row[day]?.items || []).forEach((item) => {
        const rowSpan = Math.min(
          Math.max(1, item.durationRowSpan || item.rowSpan || row[day]?.rowSpan || 1),
          scheduleData.length - rowIndex,
        );
        let lane = laneEnds.findIndex((endRow) => endRow <= rowIndex);
        if (lane === -1) lane = laneEnds.length;
        laneEnds[lane] = rowIndex + rowSpan;
        placements.push({ item, rowIndex, rowSpan, lane });
      });
    });
    return { day, laneCount: Math.max(1, laneEnds.length), placements };
  });
  let nextColumn = 2;
  dayLayouts.forEach((layout) => {
    layout.startColumn = nextColumn;
    nextColumn += layout.laneCount;
  });
  const totalColumns = nextColumn - 1;
  const title = buildExportTitle(exportMeta);
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Plan Zajęć');
  worksheet.columns = [
    { key: 'time', width: 10 },
    ...dayLayouts.flatMap((layout) => Array.from({ length: layout.laneCount }, () => ({ width: 26 }))),
  ];
  worksheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  worksheet.mergeCells(1, 1, 1, totalColumns);
  worksheet.getCell(1, 1).value = title;
  worksheet.getCell(1, 1).style = { ...headerStyle, font: { ...headerStyle.font, size: 13 } };
  worksheet.getRow(1).height = 24;

  const headerRow = worksheet.getRow(2);
  headerRow.getCell(1).value = 'Godzina';
  headerRow.getCell(1).style = headerStyle;
  dayLayouts.forEach((layout) => {
    const headerCell = headerRow.getCell(layout.startColumn);
    headerCell.value = dayLabelsMap[layout.day];
    headerCell.style = headerStyle;
    if (layout.laneCount > 1) {
      worksheet.mergeCells(2, layout.startColumn, 2, layout.startColumn + layout.laneCount - 1);
    }
  });
  headerRow.height = 22;

  scheduleData.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 3);
    excelRow.getCell(1).value = row.time.slice(0, 5);
    excelRow.getCell(1).style = timeCellStyle;
    // Jeden wiersz odpowiada 15 minutom. Prostokąty zajęć są tworzone
    // przez pionowe scalanie odpowiedniej liczby takich wierszy.
    excelRow.height = 18;
    daysOrder.forEach((day, dayIndex) => {
      const cellData = row[day];
      const cell = excelRow.getCell(dayIndex + 2);
      cell.value = '';
      cell.style = { alignment: { wrapText: true, vertical: 'top', horizontal: 'left' }, border: gridBorder };
      // Nie pomijaj komórki oznaczonej jako covered. W widoku HTML oznacza ona
      // fragment scalonego bloku, ale mogą w niej zaczynać się zajęcia równoległe.
      // W arkuszu nie scalamy komórek, aby żaden wpis nie został ukryty.
      if (!cellData) return;
      const content = getCellContent(cellData);
      cell.value = content.value;
      if (cellData.items.length > 0) {
        const classStyle = getClassStyle(cellData.items);
        cell.font = classStyle.font;
        cell.alignment = classStyle.alignment;
        cell.border = classStyle.border;
      }
    });
  });

  // Wyczyść siatkę bazową, a następnie narysuj każdy blok w przypisanym pasie.
  scheduleData.forEach((row, rowIndex) => {
    const excelRow = worksheet.getRow(rowIndex + 3);
    for (let columnIndex = 2; columnIndex <= totalColumns; columnIndex += 1) {
      const cell = excelRow.getCell(columnIndex);
      cell.value = '';
      cell.style = { alignment: { wrapText: true, vertical: 'top', horizontal: 'left' }, border: gridBorder };
    }
  });

  const exportShapes = [];
  dayLayouts.forEach((layout) => {
    layout.placements.forEach(({ item, rowIndex, rowSpan, lane }) => {
      const columnIndex = layout.startColumn + lane;
      const cell = worksheet.getCell(rowIndex + 3, columnIndex);
      const content = getCellContent({ items: [item] });
      // Dane są umieszczane w natywnej figurze Excela, nie w scalonej komórce.
      // Pozostawiamy też bezpieczny odpowiednik w komórce: jeżeli środowisko
      // nie obsłuży warstwy figur, pobrany arkusz nadal zawiera pełne dane.
      const classStyle = getClassStyle([item]);
      cell.value = content.value;
      cell.font = classStyle.font;
      cell.fill = classStyle.fill;
      cell.alignment = classStyle.alignment;
      cell.border = classStyle.border;
      exportShapes.push({ item, rowIndex, rowSpan, columnIndex });

      // Wysokość wierszy pozostaje stała. Tekst figury jest dopasowywany
      // wewnątrz prostokąta i nie zmienia układu całej siatki planu.
    });
  });

  // Zajęcia są przedstawione jako prostokątne bloki: komórka startowa jest
  // scalana na czas trwania zajęć. Gdy w środku bloku rozpoczynają się inne
  // zajęcia, pozostawiamy osobne komórki — dzięki temu żadna informacja nie
  // zostaje usunięta przez scalenie.
  [].forEach((day, dayIndex) => {
    scheduleData.forEach((row, rowIndex) => {
      const cellData = row[day];
      if (!cellData?.items?.length) return;

      const requestedRowSpan = Math.max(
        cellData.rowSpan || 1,
        ...cellData.items.map((item) => item.durationRowSpan || item.rowSpan || 1),
      );
      const rowSpan = Math.min(requestedRowSpan, scheduleData.length - rowIndex);
      const hasOverlappingStart = Array.from({ length: Math.max(0, rowSpan - 1) }).some((_, offset) => (
        scheduleData[rowIndex + offset + 1]?.[day]?.items?.length > 0
      ));
      const cell = worksheet.getCell(rowIndex + 3, dayIndex + 2);

      if (rowSpan > 1 && !hasOverlappingStart) {
        worksheet.mergeCells(rowIndex + 3, dayIndex + 2, rowIndex + rowSpan + 2, dayIndex + 2);
        cell.border = blockBorder;
        return;
      }

      // Nakładające się bloki pozostają widoczne jako niezależne prostokąty.
      // Wysokość wiersza zapewnia miejsce na komplet ich danych.
      const content = getCellContent(cellData);
      const excelRow = worksheet.getRow(rowIndex + 3);
      excelRow.height = Math.max(excelRow.height || 18, content.lineCount * 14 + 8);
    });
  });

  const defaultFileName = `plan_zajec_${group === 'all' ? 'wszystkie' : 'gr_' + group}_semestr_${semester}`;
  const workbookBuffer = await workbook.xlsx.writeBuffer();
  let buffer = workbookBuffer;
  try {
    buffer = await addRectangleShapesToWorkbook(workbookBuffer, exportShapes);
  } catch (error) {
    console.warn('Nie udało się osadzić figur w eksporcie Excel. Użyto kompatybilnego układu komórek.', error);
  }
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${customFileName || defaultFileName}.xlsx`;
  link.click();
  URL.revokeObjectURL(downloadUrl);
};

const handleExportToPdf = (scheduleData, daysOrder, dayLabelsMap, group, semester, exportMeta) => {
  if (!scheduleData || scheduleData.length === 0) {
    alert("Brak danych do wyeksportowania.");
    return;
  }

  const title = buildExportTitle(exportMeta);
  const rows = scheduleData.map((row) => {
    const cells = daysOrder.map((day) => {
      const cellData = row[day];
      if (!cellData || cellData.covered) {
        return '<td class="empty-cell"></td>';
      }

      const cellItems = (cellData.items || []).map((item) => {
        const pieces = [];
        if (item.name) pieces.push(`<div class="item-title">${String(item.name).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`);
        if (item.group) pieces.push(`<div class="item-group">gr. ${String(item.group).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`);
        if (item.start && item.end) pieces.push(`<div class="item-time">${item.start} — ${item.end}</div>`);
        if (item.details) pieces.push(`<div class="item-details">${String(item.details).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`);
        if (item.data_rozpoczecia || item.data_zakonczenia) {
          pieces.push(`<div class="item-period">Okres: ${formatDate(item.data_rozpoczecia) || '?'} - ${formatDate(item.data_zakonczenia) || '?'}</div>`);
        }
        return `<div class="schedule-block ${item.planType || 'other'}">${pieces.join('')}</div>`;
      }).join('');

      return `<td class="schedule-cell">${cellItems}</td>`;
    }).join('');

    return `<tr><td class="time-cell">${row.time.slice(0, 5)}</td>${cells}</tr>`;
  }).join('');

  const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      body { font-family: Arial, sans-serif; color: #1f2937; margin: 0; padding: 0; }
      .pdf-page { padding: 8mm; }
      .pdf-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
      .pdf-subtitle { font-size: 11px; color: #4b5563; margin-bottom: 12px; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; }
      th, td { border: 1px solid #d1d5db; padding: 6px; vertical-align: top; }
      th { background: #0f2940; color: white; font-size: 11px; text-align: center; }
      .time-cell { background: #f8fafc; font-weight: 700; width: 70px; text-align: center; font-size: 10px; }
      .schedule-cell { min-width: 140px; background: #fff; }
      .empty-cell { background: #fcfcfd; min-height: 44px; }
      .schedule-block { border-radius: 6px; padding: 6px; margin-bottom: 6px; font-size: 9px; line-height: 1.3; border-left: 4px solid #4b5563; background: #f9fafb; }
      .schedule-block.lecture { background: #fff7d6; border-left-color: #f59e0b; }
      .schedule-block.exercise { background: #e0f2fe; border-left-color: #3b82f6; }
      .schedule-block.lab { background: #f3e8ff; border-left-color: #8b5cf6; }
      .schedule-block.other { background: #f0f9f0; border-left-color: #10b981; }
      .item-title { font-weight: 700; margin-bottom: 3px; }
      .item-group { color: #4b5563; font-size: 8.5px; margin-bottom: 2px; }
      .item-time, .item-details, .item-period { font-size: 8.5px; color: #374151; margin-top: 2px; }
    </style>
  </head>
  <body>
    <div class="pdf-page">
      <div class="pdf-title">${title}</div>
      <div class="pdf-subtitle">${group && group !== 'all' ? `Grupa ${group} • ` : ''}${semester ? `Semestr ${semester}` : ''}${exportMeta?.studyMode ? ` • Tryb ${exportMeta.studyMode}` : ''}</div>
      <table>
        <thead>
          <tr>
            <th>Godzina</th>
            ${daysOrder.map((day) => `<th>${dayLabelsMap[day]}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </body>
</html>`;

  if (typeof window === 'undefined') return;
  const printWindow = window.open('', '_blank', 'width=1400,height=900');
  if (!printWindow) {
    alert('Nie udało się otworzyć okna wydruku. Sprawdź blokowanie popupów.');
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
};

const getPlanLabel = (key) => {
  if (!key) return 'Plan';
  if (key.includes('|')) {
    const [, spec, tryb] = key.split('|');
    return spec === 'Ogólne' ? `Ogólne (${tryb || 'STAC'})` : `${spec || 'Plan'} (${tryb || 'STAC'})`;
  }
  return key;
};

const getSemesterOptionLabel = (value) => {
  if (!value || value === 'all' || value === 'Wszystkie') {
    return 'Wszystkie';
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return 'Wszystkie';
  }

  if (normalizedValue.includes('|')) {
    const [semesterPart = '', specializationPart = ''] = normalizedValue.split('|');
    const semesterValue = semesterPart.trim();
    const normalizedSpec = normalizeSpecializationValue(specializationPart);

    if (!semesterValue) {
      return normalizedSpec || 'Wariant';
    }

    if (!normalizedSpec || normalizedSpec === 'Ogólne' || normalizedSpec === '') {
      return `Semestr ${semesterValue}`;
    }

    return `Semestr ${semesterValue} / ${normalizedSpec}`;
  }

  return `Semestr ${normalizedValue}`;
};

const getPlanVariantLabel = (key) => {
  if (!key) return 'Plan';
  const [semesterRaw = 'all', spec = '', mode = 'STAC'] = String(key).split('|');
  const normalizedSpec = normalizeSpecializationValue(spec);
  const semesterLabel = semesterRaw ? `Semestr ${semesterRaw}` : 'Semestr';

  if (!normalizedSpec || normalizedSpec === 'Ogólne' || normalizedSpec === '') {
    return `${semesterLabel}${mode ? ` (${mode})` : ''}`;
  }

  return `${normalizedSpec}${mode ? ` (${mode})` : ''}`;
};

const getHeaderSpecializationAbbrev = ({ selectedPlanKey, selectedSpecializationFilter, semesterFilterValue, planKeys }) => {
  const isAllSpec = (value) => {
    if (!value) return true;
    const normalized = String(value).trim();
    return normalized === 'all' || normalized === 'Wszystkie' || normalizeSpecializationValue(normalized) === 'Ogólne';
  };

  const resolvePrioritySpec = (specValue) => {
    const normalized = normalizeSpecializationValue(specValue);
    if (!normalized || isAllSpec(normalized)) return '';

    const parts = normalized.split('+').filter(Boolean);
    const priority = ['CTS', 'IOSI', 'ISP'];
    const found = priority.find((item) => parts.includes(item));
    return found || parts[0] || '';
  };

  if (!isAllSpec(selectedSpecializationFilter)) {
    const result = resolvePrioritySpec(selectedSpecializationFilter);
    if (result) return result;
  }

  if (selectedPlanKey && selectedPlanKey !== '__all__') {
    const [, spec = ''] = String(selectedPlanKey).split('|');
    const result = resolvePrioritySpec(spec);
    if (result) return result;
  }

  if (semesterFilterValue && semesterFilterValue.includes('|')) {
    const [, spec = ''] = String(semesterFilterValue).split('|');
    const result = resolvePrioritySpec(spec);
    if (result) return result;
  }

  if (planKeys.length > 0) {
    const [firstKey] = planKeys;
    if (firstKey && firstKey.includes('|')) {
      const [, spec = ''] = String(firstKey).split('|');
      const result = resolvePrioritySpec(spec);
      if (result) return result;
    }
  }

  return '';
};

const getStoredPlanistValue = (key, fallback = null) => {
  if (typeof window === 'undefined') return fallback;
  const stored = window.sessionStorage.getItem(key);
  return stored ?? fallback;
};

function ViewPlan({ user, plan = {}, stats, onBack, onClear, studyMode = 'STAC', initialSemester = null, hasPlanLoaded = true }) {
  const readStoredValue = (key, fallback) => {
    if (typeof window === 'undefined') return fallback;
    const storedValue = window.sessionStorage.getItem(key);
    return storedValue || fallback;
  };

  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState(() => {
    const storedSemester = readStoredValue('planist:lastSemesterFilter', null);
    return storedSemester && storedSemester !== 'all' ? storedSemester : '1';
  });
  const [selectedStudyModeFilter, setSelectedStudyModeFilter] = useState(() => {
    const storedMode = readStoredValue('planist:lastStudyModeLabel', null);
    return storedMode && ['STAC', 'NSTAC'].includes(storedMode) ? storedMode : 'STAC';
  });
  const [selectedSpecializationFilter, setSelectedSpecializationFilter] = useState('all');
  const [selectedPlanKey, setSelectedPlanKey] = useState('');
  const [exportFileName, setExportFileName] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('all');

  useEffect(() => {
    const fallbackSemester = semesterOptions.length > 0 ? semesterOptions[0] : '1';
    const preferredSemester = initialSemester ? String(initialSemester) : readStoredValue('planist:lastSemesterFilter', null) || fallbackSemester;
    const validSemester = semesterOptions.includes(preferredSemester)
      ? preferredSemester
      : fallbackSemester;

    setSelectedSemesterFilter((current) => {
      if (current && current !== 'all' && semesterOptions.includes(current)) {
        return current;
      }
      return validSemester;
    });

    setSelectedStudyModeFilter((current) => {
      const restoredMode = readStoredValue('planist:lastStudyModeLabel', null);
      if (current === 'all') {
        return restoredMode && ['STAC', 'NSTAC'].includes(restoredMode) ? restoredMode : normalizeStudyMode(studyMode);
      }
      if (studyModeOptions.includes(current)) {
        return current;
      }
      return restoredMode && ['STAC', 'NSTAC'].includes(restoredMode) ? restoredMode : normalizeStudyMode(studyMode);
    });
    setSelectedSpecializationFilter('all');
    setSelectedPlanKey('__all__');
    setSelectedGroup('all');
  }, [initialSemester, studyMode]);

  const normalizedPlan = useMemo(() => {
    if (!plan || typeof plan !== 'object') return {};

    if (plan.results && typeof plan.results === 'object' && !Array.isArray(plan.results)) {
      return plan.results;
    }

    if (plan.plan && typeof plan.plan === 'object' && !Array.isArray(plan.plan)) {
      return plan.plan;
    }

    if (plan.plans && typeof plan.plans === 'object' && !Array.isArray(plan.plans)) {
      return plan.plans;
    }

    if (Array.isArray(plan)) return { plan: { plan } };

    if (typeof plan === 'object' && !Array.isArray(plan)) {
      const directPlanObject = Object.entries(plan).find(([, value]) => value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value?.plan));
      if (directPlanObject) {
        return plan;
      }

      if (plan.plan && Array.isArray(plan.plan)) {
        return { plan: { plan: plan.plan, stats: plan.stats || null } };
      }

      return plan;
    }

    return {};
  }, [plan]);

  const allPlanKeys = useMemo(() => Object.keys(normalizedPlan), [normalizedPlan]);


  const semesterOptions = useMemo(() => {
    const availableSemesters = new Set();
    const semesterSpecializationOptions = new Set();

    allPlanKeys.forEach((key) => {
      if (key === 'Przedmioty wielosemestralne') return;
      const [semStr, planSpecRaw = ''] = key.split('|');
      if (!semStr) return;

      const semNumbers = getPlannerSemesters(semStr);
      const specValue = normalizeSpecializationValue(planSpecRaw);

      semNumbers.forEach((num) => {
        availableSemesters.add(num);
        if (specValue) semesterSpecializationOptions.add(`${num}|${specValue}`);
      });
    });

    const finalSemesters = new Set(['1', '2', '3', '4', '5', '6', '7', '8']);
    availableSemesters.forEach((semester) => finalSemesters.add(semester));

    const baseSemesters = [...finalSemesters].sort((a, b) => Number(a) - Number(b));

    const specializationSemesters = [...semesterSpecializationOptions]
      .sort((a, b) => {
        const [semesterA, specA = ''] = a.split('|');
        const [semesterB, specB = ''] = b.split('|');
        return Number(semesterA) - Number(semesterB) || specA.localeCompare(specB, 'pl');
      });

    const allSpecializations = [
      'Ogólne',
      'CTS',
      'IOSI',
      'ISP',
      'CTS+ISP',
      'CTS+IOSI',
      'CTS+IOSI+ISP',
    ];
    ['5', '6'].forEach((semester) => {
      allSpecializations.forEach((specialization) => {
        const option = `${semester}|${specialization}`;
        if (!specializationSemesters.includes(option)) specializationSemesters.push(option);
      });
    });

    specializationSemesters.sort((a, b) => {
      const [semesterA, specA = ''] = a.split('|');
      const [semesterB, specB = ''] = b.split('|');
      return Number(semesterA) - Number(semesterB) || specA.localeCompare(specB, 'pl');
    });

    return [...baseSemesters, ...specializationSemesters];
  }, [allPlanKeys]);

  const semesterSelectOptions = useMemo(() => semesterOptions.filter((option) => option !== 'all'), [semesterOptions]);

  const studyModeOptions = ['STAC', 'NSTAC'];

  const semesterFilterValue = useMemo(() => {
    return resolveSemesterFilterValue(selectedSemesterFilter, semesterOptions);
  }, [selectedSemesterFilter, semesterOptions]);

  useEffect(() => {
    if (!selectedSemesterFilter || selectedSemesterFilter === 'all') {
      setSelectedSemesterFilter(semesterSelectOptions[0] || '1');
    }
    if (!studyModeOptions.includes(selectedStudyModeFilter)) {
      setSelectedStudyModeFilter(studyModeOptions[0]);
    }
  }, [semesterSelectOptions, selectedSemesterFilter, selectedStudyModeFilter]);

  const filteredPlanKeysBySemAndMode = useMemo(() => {
    return allPlanKeys.filter(key => {
      if (key === 'Przedmioty wielosemestralne') {
        return semesterFilterValue === 'all';
      }
      const [semStr, planSpecRaw = '', mode] = key.split('|');
      const planSemNumbers = getPlannerSemesters(semStr);
      const selectedSemester = semesterFilterValue?.includes('|') ? semesterFilterValue.split('|')[0] : semesterFilterValue;
      const selectedSpecialization = semesterFilterValue?.includes('|') ? semesterFilterValue.split('|')[1] : null;
      const semMatch = semesterFilterValue === 'all' || (planSemNumbers.length > 0 && planSemNumbers.includes(selectedSemester));
      const specializationMatch = (() => {
        if (!selectedSpecialization || selectedSpecialization === 'all') {
          return true;
        }

        const planSpec = String(planSpecRaw || '').trim();
        // General data is merged into specialization variants during generation.
        // Therefore "Ogólne" must keep all variants for that semester visible.
        if (selectedSpecialization === 'Ogólne') {
          return true;
        }
        if (!planSpec) {
          return selectedSpecialization === 'Ogólne';
        }

        return planVariantMatchesSelectedSpecialization(planSpec, selectedSpecialization);
      })();
      const modeMatch = selectedStudyModeFilter === 'all' ? true : (mode || 'STAC') === selectedStudyModeFilter;
      return semMatch && specializationMatch && modeMatch;
    });
  }, [allPlanKeys, semesterFilterValue, selectedStudyModeFilter]);

  useEffect(() => {
    if (semesterFilterValue !== selectedSemesterFilter) {
      setSelectedSemesterFilter(semesterFilterValue);
    }
  }, [semesterFilterValue, selectedSemesterFilter]);

  const specializationOptions = useMemo(() => {
    const isSpecRelevant = filteredPlanKeysBySemAndMode.some(key => {
      const [semStr] = key.split('|');
      return ['5', '6', '8'].includes(semStr);
    });

    if (!isSpecRelevant) {
      return []; // Don't show the filter if no relevant semesters are in view
    }

    const selectedSemesterValue = selectedSemesterFilter?.includes('|') ? selectedSemesterFilter.split('|')[0] : selectedSemesterFilter;
    const semesterIsFiveOrSix = selectedSemesterValue === '5' || selectedSemesterValue === '6';
    const allPossibleSpecs = [
      'CTS',
      'IOSI',
      'ISP',
      'CTS+ISP',
      'CTS+IOSI',
      'CTS+IOSI+ISP',
    ];

    const visibleSpecs = semesterIsFiveOrSix
      ? allPossibleSpecs
      : [...allPossibleSpecs, 'Ogólne'];

    return ['all', ...(semesterIsFiveOrSix ? ['Ogólne'] : []), ...visibleSpecs];
  }, [filteredPlanKeysBySemAndMode, selectedSemesterFilter]);

  const polishWeekdaysOrder = ['Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota', 'Niedziela'];

  const filterPlanItemsBySpecialization = (items = [], selectedFilter) => {
    if (selectedFilter === 'all' || selectedFilter === 'Wszystkie') {
      return items;
    }

    return items.filter((item) => {
      const itemSpecValue = item.specjalnosc || item.specialization || '';
      return courseMatchesSelectedSpecialization(itemSpecValue, selectedFilter);
    });
  };

  const planKeys = useMemo(() => {
    let resolvedPlanKeys = [];

    const selectedSemesterValue = semesterFilterValue?.includes('|') ? semesterFilterValue.split('|')[0] : semesterFilterValue;
    const selectedSemesterSpec = semesterFilterValue?.includes('|') ? semesterFilterValue.split('|')[1] : null;

    if (selectedSpecializationFilter === 'all' || selectedSpecializationFilter === 'Wszystkie') {
      if ((selectedSemesterValue === '5' || selectedSemesterValue === '6') && selectedSemesterSpec) {
        resolvedPlanKeys = filteredPlanKeysBySemAndMode.filter((key) => {
          if (key === 'Przedmioty wielosemestralne') {
            return false;
          }
          const [, planSpecRaw = ''] = key.split('|');
          const planSpec = String(planSpecRaw || '').trim();
          return planVariantMatchesSelectedSpecialization(planSpec, selectedSemesterSpec);
        });
      } else {
        resolvedPlanKeys = filteredPlanKeysBySemAndMode;
      }
    } else {
      resolvedPlanKeys = filteredPlanKeysBySemAndMode.filter((key) => {
        if (key === 'Przedmioty wielosemestralne') {
          return false;
        }

        const variant = normalizedPlan[key];
        const planItems = Array.isArray(variant?.plan) ? variant.plan : [];

        if (planItems.length === 0) {
          const [semStr, planSpecRaw] = key.split('|');
          const planSpec = String(planSpecRaw || '').trim();
          const isRelevantSemForSpec = ['5', '6', '8'].includes(semStr);

          if (selectedSpecializationFilter === 'Ogólne') {
            return isGeneralSpecialization(planSpec);
          }

          if (isRelevantSemForSpec && isGeneralSpecialization(planSpec)) {
            return true;
          }

          return planVariantMatchesSelectedSpecialization(planSpec, selectedSpecializationFilter);
        }

        return filterPlanItemsBySpecialization(planItems, selectedSpecializationFilter).length > 0;
      });
    }

    if (semesterFilterValue === 'all' && resolvedPlanKeys.length === 0 && filteredPlanKeysBySemAndMode.length > 0) {
      const fallbackKeys = filteredPlanKeysBySemAndMode.filter((key) => key !== 'Przedmioty wielosemestralne');
      return fallbackKeys.length > 0 ? fallbackKeys : filteredPlanKeysBySemAndMode;
    }

    return resolvedPlanKeys;
  }, [filteredPlanKeysBySemAndMode, normalizedPlan, selectedSpecializationFilter, semesterFilterValue]);

  useEffect(() => {
    if (!planKeys.length) {
      setSelectedPlanKey('');
      return;
    }

    if (!selectedPlanKey || !planKeys.includes(selectedPlanKey)) {
      // When more than one matching variant exists, default to the combined view
      // so powiązane warianty (np. ASiSK + ASiSK+M3D) są widoczne razem.
      setSelectedPlanKey(planKeys.length > 1 ? '__all__' : planKeys[0]);
    }
  }, [planKeys, selectedPlanKey]);

  const planSelectionOptions = useMemo(() => {
    const options = [];
    if (planKeys.length > 1) {
      options.push({ value: '__all__', label: 'Wszystkie pasujące warianty' });
    }
    planKeys.forEach((key) => {
      options.push({ value: key, label: getPlanVariantLabel(key) });
    });
    return options;
  }, [planKeys]);

  // Combined plan data logic
  const combinedPlanData = useMemo(() => {
    if (planKeys.length === 0) {
      return {
        plan: [],
        unscheduled: [],
        stats: null,
        columnWidths: {},
        activeDays: [],
        studyMode: selectedStudyModeFilter === 'all' ? studyMode : selectedStudyModeFilter,
      };
    }

    if (planKeys.length === 1) {
      const key = planKeys[0];
      const variant = normalizedPlan[key];
      if (!variant) return { plan: [], unscheduled: [], stats: null, columnWidths: {}, activeDays: [], studyMode: selectedStudyModeFilter === 'all' ? studyMode : selectedStudyModeFilter };
      const [,, mode] = key.split('|');
      return {
        plan: filterPlanItemsBySpecialization(variant.plan || [], selectedSpecializationFilter),
        unscheduled: variant.unscheduled || [],
        stats: variant.stats || null,
        columnWidths: variant.columnWidths || {},
        activeDays: variant.activeDays || [],
        studyMode: normalizeStudyMode(mode || studyMode),
      };
    }

    // Combine multiple selected plan keys
    let combinedPlan = [];
    let combinedUnscheduled = [];
    const aggregatedStats = {
      hard: { ok: 0, total: 0 },
      soft: { ok: 0, total: 0 },
      prefs: { ok: 0, total: 0 },
      studentConflicts: { count: 0, totalStudents: 0 },
      generationTimeMs: 0,
    };
    const combinedColumnWidths = {};
    const combinedActiveDays = new Set();

    const seenPlanItems = new Map(); // For deduplicating plan items
    const seenUnscheduledItems = new Set(); // For deduplicating unscheduled items

    planKeys.forEach(key => {
      const variant = normalizedPlan[key];
      if (!variant) return;

      // Combine plan items
      filterPlanItemsBySpecialization(variant.plan || [], selectedSpecializationFilter).forEach(item => {
        const itemKey = JSON.stringify({
          day: item.day,
          time: item.time,
          name: item.name,
          lecturer: item.lecturer,
          room: item.room,
          type: item.type,
          specialization: item.specjalnosc || item.specialization || '',
          group: item.group,
          data_rozpoczecia: item.data_rozpoczecia,
          data_zakonczenia: item.data_zakonczenia,
        });
        if (!seenPlanItems.has(itemKey)) {
          seenPlanItems.set(itemKey, item);
          combinedPlan.push(item);
        }
      });

      // Combine unscheduled items
      (variant.unscheduled || []).forEach(item => {
        if (!seenUnscheduledItems.has(item.id)) {
          seenUnscheduledItems.add(item.id);
          combinedUnscheduled.push(item);
        }
      });

      // Aggregate stats
      if (variant.stats) {
        aggregatedStats.hard.ok += variant.stats.hard?.ok || 0;
        aggregatedStats.hard.total += variant.stats.hard?.total || 0;
        aggregatedStats.soft.ok += variant.stats.soft?.ok || 0;
        aggregatedStats.soft.total += variant.stats.soft?.total || 0;
        aggregatedStats.prefs.ok += variant.stats.prefs?.ok || 0;
        aggregatedStats.prefs.total += variant.stats.prefs?.total || 0;
        aggregatedStats.studentConflicts.count += variant.stats.studentConflicts?.count || 0;
        aggregatedStats.studentConflicts.totalStudents += variant.stats.studentConflicts?.totalStudents || 0;
        if (variant.stats.generationTimeMs && !aggregatedStats.generationTimeMs) {
          aggregatedStats.generationTimeMs = variant.stats.generationTimeMs;
        }
      }

      // Combine column widths
      for (const day in variant.columnWidths) {
        if (variant.columnWidths[day] === 'wide') {
          combinedColumnWidths[day] = 'wide';
        }
      }

      // Combine active days
      (variant.activeDays || []).forEach(day => combinedActiveDays.add(day));
    });

    // Recalculate percentages for aggregated stats
    const finalAggregatedStats = {
      ...aggregatedStats,
      hardOkPct: aggregatedStats.hard.total > 0 ? Math.round((aggregatedStats.hard.ok / aggregatedStats.hard.total) * 100) : 100,
      softOkPct: aggregatedStats.soft.total > 0 ? Math.round((aggregatedStats.soft.ok / aggregatedStats.soft.total) * 100) : 100,
      preferredOkPct: aggregatedStats.prefs.total > 0 ? Math.round((aggregatedStats.prefs.ok / aggregatedStats.prefs.total) * 100) : 100,
    };

    return {
      plan: combinedPlan,
      unscheduled: combinedUnscheduled,
      stats: finalAggregatedStats,
      columnWidths: combinedColumnWidths,
      activeDays: Array.from(combinedActiveDays).sort((a, b) => polishWeekdaysOrder.indexOf(a) - polishWeekdaysOrder.indexOf(b)),
      studyMode: selectedStudyModeFilter === 'all' ? studyMode : selectedStudyModeFilter,
    };
  }, [planKeys, normalizedPlan, selectedSpecializationFilter, selectedStudyModeFilter, studyMode]);

  const semesterForHeader = useMemo(() => {
    if (semesterFilterValue !== 'all') return semesterFilterValue;
    if (planKeys.length > 0) { // Use planKeys as it's the result of filtering
      return planKeys[0];
    }
    return '1';
  }, [semesterFilterValue, planKeys]);

  const headerSpecializationAbbrev = useMemo(() => getHeaderSpecializationAbbrev({
    selectedPlanKey,
    selectedSpecializationFilter,
    semesterFilterValue,
    planKeys,
  }), [selectedPlanKey, selectedSpecializationFilter, semesterFilterValue, planKeys]);

  const semesterNavigationOptions = useMemo(() => {
    // Zawsze pokazuj wszystkie semestry (1-8), aby umożliwić spójną nawigację
    // nawet jeśli bieżący plan nie zawiera danych dla każdego z nich.
    return ['1', '2', '3', '4', '5', '6', '7', '8'];
  }, []);

  const selectedNavigationSemester = selectedSemesterFilter === 'all'
    ? ''
    : String(selectedSemesterFilter).split('|')[0];
  const selectedNavigationIndex = semesterNavigationOptions.indexOf(selectedNavigationSemester);

  const selectSemesterFromNavigation = (semester) => {
    if (!semester) return;
    setSelectedSemesterFilter(semester);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('planist:lastSemesterFilter', semester);
    }
    setSelectedSpecializationFilter('all');
    setSelectedPlanKey('__all__');
    setSelectedGroup('all');
  };

  const selectedPlanData = useMemo(() => {
    if (!selectedPlanKey || selectedPlanKey === '__all__') {
      return combinedPlanData;
    }

    const variant = normalizedPlan[selectedPlanKey];
    if (!variant) {
      return {
        plan: [],
        unscheduled: [],
        stats: null,
        columnWidths: {},
        activeDays: [],
        studyMode: selectedStudyModeFilter === 'all' ? studyMode : selectedStudyModeFilter,
      };
    }

    const [, , mode] = selectedPlanKey.split('|');
    return {
      plan: filterPlanItemsBySpecialization(variant.plan || [], selectedSpecializationFilter),
      unscheduled: variant.unscheduled || [],
      stats: variant.stats || null,
      columnWidths: variant.columnWidths || {},
      activeDays: variant.activeDays || [],
      studyMode: normalizeStudyMode(mode || (selectedStudyModeFilter === 'all' ? studyMode : selectedStudyModeFilter)),
    };
  }, [combinedPlanData, normalizedPlan, selectedPlanKey, selectedSpecializationFilter, selectedStudyModeFilter, studyMode]);

  const effectivePlan = selectedPlanData.plan;
  const effectiveStats = selectedPlanData.stats;
  const unscheduledForSelectedKey = selectedPlanData.unscheduled;
  const currentStudyMode = selectedPlanData.studyMode;
  const columnWidthsForGrid = selectedPlanData.columnWidths;
  const activeDaysForGrid = selectedPlanData.activeDays;

  // Wyciągnij unikalne grupy
  const groups = useMemo(() => {
    const g = new Set()
    effectivePlan.forEach(item => {
      const group = item.group || item.grupa || item.group_id || item.grupa_id
      if (group != null) {
        if (Array.isArray(group)) {
          group.forEach(gr => {
            if (gr) g.add(String(gr));
          });
        } else if (group !== '') {
          g.add(String(group));
        }
      }
    });
    return ['all', ...Array.from(g).sort()]
  }, [effectivePlan])

  useEffect(() => {
    if (selectedGroup !== 'all' && !groups.includes(selectedGroup)) {
      setSelectedGroup('all');
    }
  }, [groups, selectedGroup]);

  // Filtruj po grupie
  const filteredPlan = useMemo(() => {
    if (selectedGroup === 'all') return effectivePlan
    return effectivePlan.filter(item => {
      const group = item.group || item.grupa || item.group_id || item.grupa_id;
      if (Array.isArray(group)) {
        return group.map(String).includes(String(selectedGroup));
      }
      return String(group) === String(selectedGroup);
    })
  }, [effectivePlan, selectedGroup])

  const schedule = useMemo(() => {
    const planItems = filteredPlan;
    const daysOrder = (currentStudyMode === 'STAC' || currentStudyMode === 'ST') ? fullTimeDaysOrder : partTimeDaysOrder;

    if (!Array.isArray(planItems)) return [];

    const timeToMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return h * 60 + m;
    };

    const parseDurationToMinutes = (value, startTime, endTime) => {
      if (value != null) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const trimmed = value.trim().toLowerCase();
          if (trimmed.endsWith('min')) return parseInt(trimmed, 10);
          if (trimmed.endsWith('h')) return parseFloat(trimmed) * 60;
          const hMatch = trimmed.match(/(\d+)h(?:\s*(\d+)min)?/);
          if (hMatch) return Number(hMatch[1]) * 60 + (hMatch[2] ? Number(hMatch[2]) : 0);
        }
      }
      if (startTime && endTime) {
        const s = timeToMinutes(startTime);
        const e = timeToMinutes(endTime);
        if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) return e - s;
      }
      return 90;
    };

    const normalizeClassType = (type) => {
      if (!type) return 'other';
      const value = String(type).toLowerCase();
      if (value.includes('wyk')) return 'lecture';
      if (value.includes('ćwic') || value.includes('cwic') || value.includes('cwicz')) return 'exercise';
      if (value.includes('lab') || value.includes('labor')) return 'lab';
      if (value.includes('proj')) return 'lab';
      if (value.includes('sem')) return 'lab';
      return 'other';
    };

    const planWithDuration = planItems.map((item) => {
      const timeRaw = item.time || item.startTime || item.czas || '';
      const parts = timeRaw.split('-').map((t) => t.trim()).filter(Boolean);
      const start = parts[0] || '';
      const end = parts[1] || '';
      const durationInMinutes = parseDurationToMinutes(item.duration, start, end);
      const dayRaw = item.day || item.day_of_week || item.dayOfWeek || '';
      const dayKey = dayMap[dayRaw.toLowerCase()] || null;
      const rawType = item.type || item.typ || '';
      const planType = normalizeClassType(rawType);
      return { ...item, start, end, duration: durationInMinutes, dayKey, planType };
    });

    const scheduleStartMinutes = 8 * 60;
    const scheduleEndMinutes = 24 * 60;

    const slots = [];
    for (let h = 8; h < 24; h += 1) {
      for (let m = 0; m < 60; m += 15) {
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }

    const grid = slots.map((slotTime) => {
      const row = { time: slotTime };
      daysOrder.forEach((day) => {
        row[day] = { items: [], covered: false, rowSpan: 1 };
      });
      return row;
    });

    // Group items per day so we can ensure a 15-minute break between consecutive classes
    const itemsByDay = {};
    planWithDuration.forEach((item) => {
      if (!item.dayKey || !item.start || !item.duration) return;
      const startMinutes = timeToMinutes(item.start);
      if (startMinutes < scheduleStartMinutes || startMinutes >= scheduleEndMinutes) return;
      if (!itemsByDay[item.dayKey]) itemsByDay[item.dayKey] = [];
      itemsByDay[item.dayKey].push({ ...item, startMinutes });
    });

    Object.keys(itemsByDay).forEach((dayKey) => {
      const list = itemsByDay[dayKey];
        list.sort((a, b) => a.startMinutes - b.startMinutes);
        let prevEnd = null;
        let parallelGroupStart = null;
        let parallelEndMinutes = null;
        let segmentOriginalStart = null;
        let segmentOriginalEnd = null;
        list.forEach((item) => {
          const sameSegment = segmentOriginalStart != null && item.startMinutes < segmentOriginalEnd;
          if (!sameSegment) {
            segmentOriginalStart = item.startMinutes;
            parallelGroupStart = item.startMinutes;
            parallelEndMinutes = parallelGroupStart + item.duration;
            segmentOriginalEnd = item.startMinutes + item.duration;
          } else {
            segmentOriginalEnd = Math.max(segmentOriginalEnd, item.startMinutes + item.duration);
          }

        const layoutStartMinutes = parallelGroupStart ?? item.startMinutes;
        const startSlotIndex = Math.floor((layoutStartMinutes - scheduleStartMinutes) / 15);
        if (startSlotIndex < 0 || startSlotIndex >= grid.length) {
          prevEnd = item.startMinutes + item.duration;
          return;
        }

        const rowSpan = Math.max(1, Math.ceil((Math.max(item.startMinutes, layoutStartMinutes) + item.duration - layoutStartMinutes) / 15));
        const dayCell = grid[startSlotIndex]?.[item.dayKey];
        if (!dayCell) {
          prevEnd = item.startMinutes + item.duration;
          return;
        }

        const groups = Array.isArray(item.group) ? item.group.filter(Boolean) : (item.group ? [String(item.group)] : []);
        const groupInfo = groups.join(', ');
        const details = [item.type, item.specjalnosc, item.room, item.lecturer].filter(Boolean).join(' • ');

        dayCell.items.push({ name: item.name || 'Zajęcia', fullName: item.fullName || item.name, type: item.type, specjalnosc: item.specjalnosc, room: item.room, lecturer: item.lecturer, details: details, duration: item.duration, durationRowSpan: Math.max(1, Math.ceil(item.duration / 15)), rowSpan: rowSpan, offsetSlots: Math.max(0, Math.ceil((item.startMinutes - layoutStartMinutes) / 15)), start: formatTime(item.startMinutes), end: formatTime(item.startMinutes + item.duration), group: groupInfo, planType: item.planType || 'other', data_rozpoczecia: item.data_rozpoczecia, data_zakonczenia: item.data_zakonczenia });
        dayCell.rowSpan = Math.max(dayCell.rowSpan || 1, rowSpan);

        for (let i = 1; i < rowSpan; i += 1) {
          const nextSlotIndex = startSlotIndex + i;
          if (nextSlotIndex < grid.length) { grid[nextSlotIndex][item.dayKey].covered = true; }
        }

        parallelEndMinutes = Math.max(parallelEndMinutes, parallelGroupStart + item.duration);
        prevEnd = Math.max(prevEnd || 0, item.startMinutes + item.duration);
      });
    });

    grid.forEach((row) => daysOrder.forEach((day) => {
      const cell = row[day];
      if (!cell || cell.items.length < 2) return;
      const sharedStart = Math.min(...cell.items.map((item) => timeToMinutes(item.start)));
      const sharedEnd = Math.max(...cell.items.map((item) => timeToMinutes(item.end)));
      cell.items = cell.items.map((item) => ({ ...item, start: formatTime(sharedStart), end: formatTime(sharedEnd) }));
    }));

    return grid;
  }, [filteredPlan, currentStudyMode]);

  const isAnyPlanLoaded = allPlanKeys.length > 0;
  const selectedPlanLabel = (() => {
    if (selectedPlanKey && selectedPlanKey !== '__all__') {
      return getPlanVariantLabel(selectedPlanKey);
    }

    if (selectedSemesterFilter && selectedSemesterFilter !== 'all') {
      const [semesterValue, specializationValue] = String(selectedSemesterFilter).split('|');
      const semesterLabel = semesterValue ? `Semestr ${semesterValue}` : 'Semestr';
      const specializationLabel = specializationValue && specializationValue !== 'all' && specializationValue !== 'Ogólne'
        ? ` / ${specializationValue}`
        : '';
      return `${semesterLabel}${specializationLabel}`;
    }

    return 'Wszystkie pasujące warianty';
  })();

  return (
    <div className="student-plan-page">
      <div className="student-plan-card">
        <div className="plan-header">
          <div>
            <div className="plan-label">📋 Plan zajęć</div>
            <h1>{getHeaderText(semesterForHeader, headerSpecializationAbbrev)}</h1>
            <p className="plan-subtitle">
              semestr letni 2026/2027
              {user?.login && ` • Wykładowca: ${user.login}`}
            </p>
          </div>
          {/* Removed the tabs container as the filtering is now done via selects */}
        </div>

        {isAnyPlanLoaded && hasPlanLoaded && effectiveStats && (
          <div className="stats-container" style={{ marginTop: '1rem' }}>
            <h4>Wyniki optymalizacji:</h4>
            <p>Spełnione ograniczenia twarde: {effectiveStats.hardOkPct}% ({effectiveStats.hard?.ok || 0}/{effectiveStats.hard?.total || 0})</p>
            <p>Spełnione ograniczenia miękkie: {effectiveStats.softOkPct}% ({effectiveStats.soft?.ok || 0}/{effectiveStats.soft?.total || 0})</p>
            <p>Spełnione preferencje: {effectiveStats.preferredOkPct}% ({effectiveStats.prefs?.ok || 0}/{effectiveStats.prefs?.total || 0})</p>
            {effectiveStats.studentConflicts != null && (
              <p>Konflikty w planie studentów: {effectiveStats.studentConflicts.count}</p>
            )}
            {effectiveStats.generationTimeMs != null && (
              <p>Czas generowania: <strong>{(effectiveStats.generationTimeMs / 1000).toFixed(2)} s</strong></p>
            )}
          </div>
        )}

        {/* Removed statsForSelectedKey as effectiveStats now handles combined stats */}

        <div className="plan-filters" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #eee', paddingBottom: '1rem' }}>
            <div className="plan-select">
                <label>
                    Semestr
                    <select value={semesterSelectOptions.includes(selectedSemesterFilter) ? selectedSemesterFilter : semesterSelectOptions[0] || '1'} onChange={(e) => {
                      const semester = e.target.value;
                      setSelectedSemesterFilter(semester);
                      if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem('planist:lastSemesterFilter', semester);
                      }
                      setSelectedSpecializationFilter('all');
                      setSelectedPlanKey('__all__');
                      setSelectedGroup('all');
                    }}>
                        {semesterSelectOptions.map((s) => (
                            <option key={s} value={s}>
                                {getSemesterOptionLabel(s)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {semesterNavigationOptions.length > 0 && (
              <div className="semester-navigation" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <button
                  type="button"
                  className="card-back-button"
                  disabled={selectedNavigationIndex <= 0}
                  onClick={() => selectSemesterFromNavigation(semesterNavigationOptions[selectedNavigationIndex - 1])}
                >
                  « Poprzedni
                </button>
                <button
                  type="button"
                  className="card-back-button"
                  disabled={selectedNavigationIndex >= semesterNavigationOptions.length - 1}
                  onClick={() => selectSemesterFromNavigation(semesterNavigationOptions[selectedNavigationIndex < 0 ? 0 : selectedNavigationIndex + 1])}
                >
                  Następny »
                </button>
              </div>
            )}
            {specializationOptions.length > 0 && (
                <div className="plan-select">
                    <label htmlFor="spec-filter-planist">Specjalność</label>
                    <select
                        id="spec-filter-planist"
                        value={selectedSpecializationFilter}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedSpecializationFilter(value);
                          if (typeof window !== 'undefined') {
                            window.sessionStorage.setItem('planist:lastSpecializationLabel', value);
                          }
                          setSelectedPlanKey('__all__');
                          setSelectedGroup('all');
                        }}
                    >
                        {specializationOptions.map(spec => (
                            <option key={spec} value={spec}>
                                {spec === 'all' ? 'Wszystkie' : spec}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            <div className="plan-select">
                <label>
                    Tryb studiów
                    <select value={studyModeOptions.includes(selectedStudyModeFilter) ? selectedStudyModeFilter : studyModeOptions[0]} onChange={(e) => {
                      const value = e.target.value;
                      setSelectedStudyModeFilter(value);
                      if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem('planist:lastStudyModeLabel', value);
                      }
                      setSelectedPlanKey('__all__');
                      setSelectedGroup('all');
                    }}>
                        {studyModeOptions.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </label>
            </div>
            {allPlanKeys.length > 1 && (
              <div className="plan-select">
                <label>
                  Wariant planu
                  <select value={selectedPlanKey || '__all__'} onChange={(e) => {
                    setSelectedPlanKey(e.target.value);
                    setSelectedGroup('all');
                  }}>
                    {planSelectionOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {groups.length > 1 && (
              <div className="plan-select">
                <label>
                  Grupa
                  <select
                    key={`${selectedSemesterFilter}|${selectedSpecializationFilter}|${selectedStudyModeFilter}|${selectedPlanKey}`}
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                  >
                    {groups.map(g => (
                      <option key={g} value={g}>{g === 'all' ? 'Wszystkie grupy' : `Grupa ${g}`}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
        </div>

        {unscheduledForSelectedKey.length > 0 && (
          <div className="error-message" style={{ marginTop: '1rem', padding: '1rem' }}>
            <strong>Nie udało się zaplanować {unscheduledForSelectedKey.length} zajęć.</strong>
            <p style={{ margin: '0.5rem 0 0' }}>
              Sprawdź dostępność prowadzącego, przypisaną salę oraz zakres godzin generowania planu.
            </p>
            <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
              {unscheduledForSelectedKey.map((item, index) => (
                <li key={`${item.id || item.name}-${index}`}>
                  {item.name || 'Zajęcia'}{item.lecturer ? ` — ${item.lecturer}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isAnyPlanLoaded || !hasPlanLoaded ? (
          <div className="empty-state">
            <p>Brak wygenerowanego planu.</p>
            <p style={{ fontSize: '0.9rem', color: '#888' }}>
              Przejdź do generatora i wygeneruj plan.
            </p>
          </div>
        ) : <ScheduleGrid schedule={schedule} studyMode={currentStudyMode} columnWidths={columnWidthsForGrid} activeDays={activeDaysForGrid} />}
        <div className="admin-form-actions" style={{ marginTop: '20px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
          <button type="button" className="card-back-button" onClick={onBack}>
            ⬅ Powrót
          </button>
          {isAnyPlanLoaded && hasPlanLoaded && (
            <>
                <button type="button" onClick={onClear}>
                  🗑️ Wyczyść plan
                </button>
                <button type="button" disabled>
                  ✏️ Edytuj
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                        type="text"
                        value={exportFileName}
                        onChange={(e) => setExportFileName(e.target.value)}
                        placeholder="Nazwa pliku (opcjonalnie)"
                        style={{ padding: '12px 16px', borderRadius: '18px', border: '1px solid rgba(15, 41, 64, 0.12)', background: '#fff' }}
                    />
                    <button type="button" onClick={() => handleExportToExcel(schedule, (currentStudyMode === 'STAC' || currentStudyMode === 'ST') ? fullTimeDaysOrder : partTimeDaysOrder, dayLabels, selectedGroup, semesterForHeader, exportFileName, {
                      semester: semesterForHeader,
                      studyMode: currentStudyMode,
                      specialization: selectedSpecializationFilter,
                      group: selectedGroup,
                      selectedPlanLabel,
                    })}>
                      📥 Eksportuj (Excel)
                    </button>
                    <button type="button" onClick={() => handleExportToPdf(schedule, (currentStudyMode === 'STAC' || currentStudyMode === 'ST') ? fullTimeDaysOrder : partTimeDaysOrder, dayLabels, selectedGroup, semesterForHeader, {
                      semester: semesterForHeader,
                      studyMode: currentStudyMode,
                      specialization: selectedSpecializationFilter,
                      group: selectedGroup,
                      selectedPlanLabel,
                    })}>
                      🖨️ Eksportuj (PDF)
                    </button>
                </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ViewPlan
