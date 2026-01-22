import React, { useState, useEffect, useMemo } from 'react';
import { questions } from './bingoData';
import useStudents from './hooks/useStudents';
import { Button, Card } from './components/ui';
import { getImageUrl } from './supabase';

// Genereer dynamisch de keys op basis van de questions
const questionKeys = Object.keys(questions);

// Helper om lege state objecten te maken
const createEmptyMatches = () => {
  const matches = {};
  questionKeys.forEach(q => { matches[q] = null; });
  return matches;
};

const normalizeMatches = (rawMatches) => {
  const empty = createEmptyMatches();
  if (!rawMatches || typeof rawMatches !== 'object') return empty;
  questionKeys.forEach((q) => {
    const cell = rawMatches[q];
    if (cell && typeof cell === 'object' && cell.answer) {
      empty[q] = cell;
    }
  });
  return empty;
};

const computeLogged = (m) => {
  const next = {
    rows: [false, false, false, false, false],
    cols: [false, false, false, false, false],
    diag1: false,
    diag2: false,
    full: false,
  };

  for (let row = 0; row < 5; row += 1) {
    next.rows[row] = [0, 1, 2, 3, 4].every((col) => {
      const q = `Q${row * 5 + col + 1}`;
      return m[q]?.answer;
    });
  }

  for (let col = 0; col < 5; col += 1) {
    next.cols[col] = [0, 1, 2, 3, 4].every((row) => {
      const q = `Q${row * 5 + col + 1}`;
      return m[q]?.answer;
    });
  }

  next.diag1 = [0, 1, 2, 3, 4].every((i) => {
    const q = `Q${i * 5 + i + 1}`;
    return m[q]?.answer;
  });

  next.diag2 = [0, 1, 2, 3, 4].every((i) => {
    const q = `Q${i * 5 + (4 - i) + 1}`;
    return m[q]?.answer;
  });

  next.full = questionKeys.every((q) => m[q]?.answer);
  return next;
};

const createEmptySelections = () => {
  const selections = {};
  questionKeys.forEach(q => { selections[q] = { selectedAnswer: '', selectedStudent: '' }; });
  return selections;
};

const createEmptyFeedback = () => {
  const feedback = {};
  questionKeys.forEach(q => { feedback[q] = null; });
  return feedback;
};

// Helper om te checken of een student antwoorden heeft ingevuld
const hasFilledAnswers = (studentData) => {
  if (!studentData) return false;
  return questionKeys.some(q => {
    const answers = studentData[q] || [];
    return answers.length > 0 && answers.some(a => a && a.trim() !== '');
  });
};

// Helper om te checken of ALLE vragen zijn beantwoord
const hasAllAnswersFilled = (studentData) => {
  if (!studentData) return false;
  return questionKeys.every(q => {
    const answers = studentData[q] || [];
    return answers.length > 0 && answers.some(a => a && a.trim() !== '');
  });
};

export default function Bingo({ selectedStudentId, previewMode = false }) {
  const [students, setStudents, { save: saveStudents }] = useStudents();

  const activeStudentRecord = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );
  const activeSemesterId = activeStudentRecord?.semesterId || null;

  const semesterStudents = useMemo(() => {
    if (!activeSemesterId) return students;
    return students.filter(
      (s) => String(s.semesterId || '') === String(activeSemesterId)
    );
  }, [students, activeSemesterId]);

  const studentAnswers = useMemo(() => {
    const map = {};
    const emptyBingo = createEmptyMatches();
    for (const s of semesterStudents) {
      const bingo = s.bingo || emptyBingo;
      map[s.id] = { name: s.name, ...bingo };
    }
    return map;
  }, [semesterStudents]);

  const studentIds = useMemo(() => Object.keys(studentAnswers), [studentAnswers]);

  // State voor matches (afgetekende vakjes)
  const [matches, setMatches] = useState(createEmptyMatches);
  
  // State voor de huidige selectie per vraag: welk antwoord en welke student
  const [selections, setSelections] = useState(createEmptySelections);
  
  // State voor feedback na check
  const [feedback, setFeedback] = useState(createEmptyFeedback);

  // Logged state voor bingo patronen (5x5 grid)
  const [logged, setLogged] = useState({
    rows: [false, false, false, false, false],
    cols: [false, false, false, false, false],
    diag1: false,
    diag2: false,
    full: false,
  });

  useEffect(() => {
    const restoredMatches = normalizeMatches(activeStudentRecord?.bingoMatches);
    setMatches(restoredMatches);
    setSelections(createEmptySelections());
    setFeedback(createEmptyFeedback());
    setLogged(computeLogged(restoredMatches));
  }, [activeStudentRecord?.id, activeStudentRecord?.bingoMatches]);

  if (!selectedStudentId || !studentAnswers[selectedStudentId]) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={getImageUrl('voorpagina.png')} alt="Background" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 p-4 max-w-4xl mx-auto">
          <Card title="Bingo">
            <p>Je moet ingelogd zijn om jouw bingokaart te bekijken.</p>
          </Card>
        </div>
      </div>
    );
  }

  // Check of de student al antwoorden heeft ingevuld
  const myData = studentAnswers[selectedStudentId];
  if (!hasFilledAnswers(myData)) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={getImageUrl('voorpagina.png')} alt="Background" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 p-4 max-w-4xl mx-auto">
          <Card title="Bingo">
            <p className="mb-4">Je hebt nog geen bingo-antwoorden ingevuld. Vul eerst je antwoorden in om mee te kunnen doen!</p>
            <div className="flex gap-4">
              <Button
                className="bg-indigo-600 text-white"
                onClick={() => window.location.hash = '/bingo/edit'}
              >
                Antwoorden invullen
              </Button>
              <Button
                className="bg-gray-600 text-white"
                onClick={() => window.location.hash = '/student'}
              >
                Overzicht
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const activeStudent = selectedStudentId;

  const checkPatterns = (m) => {
    const nextLogged = computeLogged(m);

    nextLogged.rows.forEach((rowComplete, row) => {
      if (rowComplete && !logged.rows[row]) {
        console.log(`Bingo voor ${activeStudent}: horizontale rij ${row + 1}`);
      }
    });

    nextLogged.cols.forEach((colComplete, col) => {
      if (colComplete && !logged.cols[col]) {
        console.log(`Bingo voor ${activeStudent}: verticale kolom ${col + 1}`);
      }
    });

    if (nextLogged.diag1 && !logged.diag1) {
      console.log(`Bingo voor ${activeStudent}: diagonaal ↘`);
    }
    if (nextLogged.diag2 && !logged.diag2) {
      console.log(`Bingo voor ${activeStudent}: diagonaal ↙`);
    }
    if (nextLogged.full && !logged.full) {
      console.log(`Bingo voor ${activeStudent}: volledige kaart!`);
    }

    setLogged(nextLogged);
  };

  const handleAnswerSelect = (q, answer) => {
    setSelections((prev) => ({
      ...prev,
      [q]: { ...prev[q], selectedAnswer: answer }
    }));
    // Reset feedback wanneer een nieuwe selectie wordt gemaakt
    setFeedback((prev) => ({ ...prev, [q]: null }));
  };

  const handleStudentSelect = (q, studentId) => {
    setSelections((prev) => ({
      ...prev,
      [q]: { ...prev[q], selectedStudent: studentId }
    }));
    // Reset feedback wanneer een nieuwe selectie wordt gemaakt
    setFeedback((prev) => ({ ...prev, [q]: null }));
  };

  const handleCheck = (q) => {
    const { selectedAnswer, selectedStudent } = selections[q];
    
    if (!selectedAnswer || !selectedStudent) {
      setFeedback((prev) => ({
        ...prev,
        [q]: { success: false, message: 'Selecteer eerst een antwoord én een student!' }
      }));
      return;
    }

    // Controleer of de geselecteerde student dit antwoord ook heeft
    const otherAnswers = studentAnswers[selectedStudent][q] || [];
    const hasMatch = otherAnswers.some(
      (a) => a.toLowerCase() === selectedAnswer.toLowerCase()
    );

    if (hasMatch) {
      // Match gevonden!
      const next = { 
        ...matches, 
        [q]: { 
          otherId: selectedStudent, 
          otherName: studentAnswers[selectedStudent].name,
          answer: selectedAnswer 
        } 
      };
      setMatches(next);
      if (!previewMode) {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === selectedStudentId ? { ...s, bingoMatches: next } : s
          )
        );
        saveStudents().then(({ error }) => {
          if (error) {
            alert('Kon bingo matches niet opslaan: ' + error.message);
          }
        });
      }
      setFeedback((prev) => ({
        ...prev,
        [q]: { success: true, message: `Match gevonden met ${studentAnswers[selectedStudent].name}!` }
      }));
      checkPatterns(next);
    } else {
      // Geen match
      setFeedback((prev) => ({
        ...prev,
        [q]: { 
          success: false, 
          message: `${studentAnswers[selectedStudent].name} heeft "${selectedAnswer}" niet in de lijst staan. Probeer opnieuw!` 
        }
      }));
    }
  };

  const hasHorizontal = logged.rows.some(r => r);
  const hasVertical = logged.cols.some(c => c);
  const hasDiagonal = logged.diag1 || logged.diag2;
  const hasFull = logged.full;
  const matchCount = questionKeys.filter(q => matches[q]?.answer).length;
  
  // Check of er nog onbeantwoorde vragen zijn
  const hasUnanswered = !hasAllAnswersFilled(myData);

  return (
    <div className="relative min-h-screen">
      {/* Background image */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img src={getImageUrl('voorpagina.png')} alt="Background" className="w-full h-full object-cover" />
      </div>

      {/* Main content */}
      <div className="relative z-10 p-2 sm:p-4 max-w-4xl mx-auto">
        <div className="mb-4 flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold bg-white/90 px-3 py-1 rounded">
            Bingo - {studentAnswers[activeStudent].name}
          </h2>
          <div className="flex gap-2 flex-wrap">
            {hasUnanswered && (
              <Button
                className="bg-indigo-600 text-white"
                onClick={() => window.location.hash = '/bingo/edit'}
              >
                Vragen invullen
              </Button>
            )}
            <Button
              className="bg-gray-600 text-white"
              onClick={() => window.location.hash = previewMode ? '/admin/preview' : '/student'}
            >
              {previewMode ? 'Terug naar preview' : 'Overzicht'}
            </Button>
          </div>
        </div>

        {hasUnanswered && (
          <Card className="mb-4 bg-yellow-50 border-yellow-300">
            <p className="text-sm text-yellow-800">
              ⚠️ Je hebt nog niet alle vragen beantwoord. Klik op "Vragen invullen" om de rest in te vullen!
            </p>
          </Card>
        )}

        <Card className="mb-4">
            <p className="text-sm text-blue-800">
              <strong>Zo werkt het:</strong> Selecteer eerst welk antwoord je denkt te delen met iemand anders, 
            kies dan die persoon, en klik op "Controleer" om te checken of het klopt!
            Docent kan antwoorden achteraf corrigeren bij typefouten.
            </p>
        </Card>

        <Card className="mb-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs sm:text-sm">
            <div className={`p-1.5 sm:p-2 rounded text-center ${hasHorizontal ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
              Horizontaal: {hasHorizontal ? '✓' : '–'}
            </div>
            <div className={`p-1.5 sm:p-2 rounded text-center ${hasVertical ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
              Verticaal: {hasVertical ? '✓' : '–'}
            </div>
            <div className={`p-1.5 sm:p-2 rounded text-center ${hasDiagonal ? 'bg-green-100 text-green-800' : 'bg-gray-100'}`}>
              Diagonaal: {hasDiagonal ? '✓' : '–'}
            </div>
            <div className={`p-1.5 sm:p-2 rounded text-center ${hasFull ? 'bg-yellow-100 text-yellow-800 font-semibold' : 'bg-gray-100'}`}>
              Volle kaart: {hasFull ? '🎉' : '–'}
            </div>
            <div className={`p-1.5 sm:p-2 rounded text-center bg-blue-100 text-blue-800 col-span-2 sm:col-span-1`}>
              Matches: {matchCount}/25
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2 sm:gap-3">
          {questionKeys.map((q) => {
            const cell = matches[q];
            const hasMatch = cell?.answer;
            const myAnswers = studentAnswers[activeStudent][q] || [];
            const selection = selections[q];
            const cellFeedback = feedback[q];

            return (
              <Card key={q} className={hasMatch ? 'bg-green-100 border-green-400' : ''}>
                {hasMatch ? (
                  <div>
                    <div className="font-semibold mb-1 text-sm sm:text-base">{questions[q]}</div>
                    <div className="text-green-800 text-sm">
                      🎉 Match met <strong>{cell.otherName}</strong> op: <strong>{cell.answer}</strong>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-semibold mb-2 text-sm sm:text-base">{questions[q]}</div>
                  
                    {/* Stap 1: Selecteer een van je antwoorden */}
                    <div className="mb-2 sm:mb-3">
                      <label className="text-xs sm:text-sm text-gray-600 block mb-1">
                        1. Welk antwoord denk je te delen?
                      </label>
                      <div className="space-y-1">
                        {myAnswers.map((answer, i) => (
                          <label 
                            key={i} 
                            className={`flex items-center gap-2 p-1.5 sm:p-2 rounded cursor-pointer border text-sm ${
                              selection.selectedAnswer === answer 
                                ? 'bg-indigo-100 border-indigo-400' 
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`answer-${q}`}
                              value={answer}
                              checked={selection.selectedAnswer === answer}
                              onChange={() => handleAnswerSelect(q, answer)}
                              className="accent-indigo-600"
                            />
                            <span className="break-words">{answer}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Stap 2: Selecteer een student */}
                    <div className="mb-2 sm:mb-3">
                      <label className="text-xs sm:text-sm text-gray-600 block mb-1">
                        2. Met wie denk je dit te delen?
                      </label>
                      <select
                        value={selection.selectedStudent}
                        onChange={(e) => handleStudentSelect(q, e.target.value)}
                        className="border p-2 rounded w-full text-sm"
                      >
                        <option value="">Kies een student...</option>
                        {studentIds
                          .filter((id) => id !== activeStudent)
                          .sort((a, b) => 
                            studentAnswers[a].name.localeCompare(studentAnswers[b].name, 'nl')
                          )
                          .map((id) => (
                            <option key={id} value={id}>
                              {studentAnswers[id].name}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Stap 3: Controleer */}
                    <Button
                      className={`w-full ${
                        selection.selectedAnswer && selection.selectedStudent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-300 text-gray-500'
                      }`}
                      disabled={!selection.selectedAnswer || !selection.selectedStudent}
                      onClick={() => handleCheck(q)}
                    >
                      Controleer
                    </Button>

                    {/* Feedback */}
                    {cellFeedback && (
                      <div className={`mt-2 p-2 rounded text-sm ${
                        cellFeedback.success 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {cellFeedback.success ? '✅' : '❌'} {cellFeedback.message}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
