import React, { useState, useMemo } from 'react';
import { questions } from './bingoData';
import useStudents from './hooks/useStudents';
import { Button, TextInput, Card } from './components/ui';
import { getImageUrl } from './supabase';

const nameCollator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true });

// Genereer dynamisch de keys op basis van de questions
const questionKeys = Object.keys(questions);

// Helper om lege answers object te maken
const createEmptyAnswers = () => {
  const answers = {};
  questionKeys.forEach(q => {
    answers[q] = ['', '', ''];
  });
  return answers;
};

export default function BingoAdmin() {
  const [students, setStudents, { save: saveStudents }] = useStudents();
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [answers, setAnswers] = useState(createEmptyAnswers);
  const [saved, setSaved] = useState(false);

  const sortedStudents = useMemo(() => 
    [...students].sort((a, b) => nameCollator.compare(a.name || '', b.name || '')),
    [students]
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const handleStudentSelect = (studentId) => {
    setSelectedStudentId(studentId);
    setEditMode(false);
    setSaved(false);
    
    const student = students.find((s) => s.id === studentId);
    if (student?.bingo) {
      const newAnswers = {};
      questionKeys.forEach(q => {
        newAnswers[q] = [...(student.bingo[q] || []), '', '', ''].slice(0, 3);
      });
      setAnswers(newAnswers);
    } else {
      setAnswers(createEmptyAnswers());
    }
  };

  const handleAnswerChange = (q, index, value) => {
    setAnswers((prev) => ({
      ...prev,
      [q]: prev[q].map((a, i) => (i === index ? value : a)),
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    const cleanedAnswers = {};
    questionKeys.forEach(q => {
      cleanedAnswers[q] = answers[q].map((a) => a.trim()).filter(Boolean);
    });
    
    setStudents((prev) =>
      prev.map((s) =>
        s.id === selectedStudentId
          ? { ...s, bingo: cleanedAnswers }
          : s
      )
    );
    const { error } = await saveStudents();
    if (error) {
      alert('Kon bingo niet opslaan: ' + error.message);
      return;
    }
    setSaved(true);
    setEditMode(false);
  };

  // Overzicht van alle antwoorden per vraag
  const allAnswersByQuestion = useMemo(() => {
    const result = {};
    questionKeys.forEach(q => { result[q] = {}; });
    
    for (const student of students) {
      if (!student.bingo) continue;
      
      for (const q of questionKeys) {
        const answers = student.bingo[q] || [];
        for (const answer of answers) {
          const normalized = answer.toLowerCase().trim();
          if (!normalized) continue;
          
          if (!result[q][normalized]) {
            result[q][normalized] = { 
              original: answer, 
              students: [],
              variations: new Set([answer])
            };
          }
          result[q][normalized].students.push(student.name);
          result[q][normalized].variations.add(answer);
        }
      }
    }
    
    return result;
  }, [students]);

  return (
    <div className="relative min-h-screen">
      {/* Background image */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img src={getImageUrl('voorpagina.png')} alt="Background" className="w-full h-full object-cover" />
      </div>

      {/* Main content */}
      <div className="relative z-10 p-4 max-w-4xl mx-auto">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold bg-white/90 px-3 py-1 rounded">Bingo Beheer (Docent)</h2>
          <Button
            className="bg-gray-600 text-white"
            onClick={() => window.location.hash = '/admin'}
          >
            Terug naar admin
          </Button>
        </div>

        <Card className="mb-6">
          <p className="text-sm text-gray-600">
            Hier kun je de bingo-antwoorden van studenten bekijken en aanpassen. 
            Handig om schrijfwijzes te corrigeren zodat matches beter werken (bijv. "Borsato" → "Marco Borsato").
          </p>
        </Card>

      {/* Student selector */}
      <Card title="Selecteer student" className="mb-6">
        <select
          value={selectedStudentId}
          onChange={(e) => handleStudentSelect(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="">Kies een student...</option>
          {sortedStudents.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name || s.email || s.id}
              {s.bingo ? ' ✓' : ' (geen bingo data)'}
            </option>
          ))}
        </select>
      </Card>

      {/* Student bewerken */}
      {selectedStudent && (
        <Card title={`Antwoorden van ${selectedStudent.name}`} className="mb-6">
          {!editMode ? (
            <div>
              {questionKeys.map((q) => (
                <div key={q} className="mb-4">
                  <div className="font-medium text-gray-700">{questions[q]}</div>
                  <ul className="list-disc ml-6 text-gray-600">
                    {(selectedStudent.bingo?.[q] || []).length > 0 ? (
                      selectedStudent.bingo[q].map((a, i) => (
                        <li key={i}>{a}</li>
                      ))
                    ) : (
                      <li className="text-gray-400 italic">Geen antwoorden</li>
                    )}
                  </ul>
                </div>
              ))}
              <Button
                className="bg-indigo-600 text-white mt-4"
                onClick={() => setEditMode(true)}
              >
                Bewerken
              </Button>
            </div>
          ) : (
            <div>
              {questionKeys.map((q) => (
                <div key={q} className="mb-4">
                  <div className="font-medium text-gray-700 mb-2">{questions[q]}</div>
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <TextInput
                        key={i}
                        value={answers[q][i]}
                        onChange={(value) => handleAnswerChange(q, i, value)}
                        placeholder={`Antwoord ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-4">
                <Button
                  className="bg-indigo-600 text-white"
                  onClick={handleSave}
                >
                  Opslaan
                </Button>
                <Button
                  className="bg-gray-300"
                  onClick={() => {
                    setEditMode(false);
                    handleStudentSelect(selectedStudentId); // Reset
                  }}
                >
                  Annuleren
                </Button>
                {saved && <span className="text-green-600 self-center">✓ Opgeslagen!</span>}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Overzicht van potentiële matches */}
      <Card title="Overzicht: Mogelijke matches per categorie" className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Dit overzicht toont antwoorden die door meerdere studenten zijn gegeven. 
          Let op verschillende schrijfwijzes die eigenlijk hetzelfde zijn!
        </p>
        
        {questionKeys.map((q) => {
          const answersWithMultiple = Object.entries(allAnswersByQuestion[q])
            .filter(([_, data]) => data.students.length > 1)
            .sort((a, b) => b[1].students.length - a[1].students.length);

          return (
            <div key={q} className="mb-6">
              <h4 className="font-semibold text-gray-800 mb-2">{questions[q]}</h4>
              {answersWithMultiple.length > 0 ? (
                <div className="space-y-2">
                  {answersWithMultiple.map(([key, data]) => (
                    <div key={key} className="bg-green-50 p-2 rounded border border-green-200">
                      <div className="font-medium text-green-800">
                        "{data.original}" ({data.students.length} studenten)
                      </div>
                      <div className="text-sm text-gray-600">
                        {data.students.join(', ')}
                      </div>
                      {data.variations.size > 1 && (
                        <div className="text-xs text-orange-600 mt-1">
                          ⚠️ Verschillende schrijfwijzes: {[...data.variations].join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm">
                  Geen antwoorden met meerdere studenten gevonden
                </p>
              )}
            </div>
          );
        })}
      </Card>

      {/* Alle unieke antwoorden met slechts 1 student */}
      <Card title="Unieke antwoorden (geen match mogelijk)">
        <p className="text-sm text-gray-600 mb-4">
          Deze antwoorden zijn door slechts één student gegeven. 
          Mogelijk zijn er vergelijkbare antwoorden met andere schrijfwijzes die je kunt harmoniseren.
        </p>
        
        {questionKeys.map((q) => {
          const uniqueAnswers = Object.entries(allAnswersByQuestion[q])
            .filter(([_, data]) => data.students.length === 1)
            .map(([_, data]) => ({ answer: data.original, student: data.students[0] }))
            .sort((a, b) => a.answer.localeCompare(b.answer, 'nl'));

          return (
            <div key={q} className="mb-4">
              <h4 className="font-semibold text-gray-800 mb-2">{questions[q]}</h4>
              {uniqueAnswers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {uniqueAnswers.map(({ answer, student }, i) => (
                    <span 
                      key={i} 
                      className="bg-gray-100 px-2 py-1 rounded text-sm"
                      title={`Door: ${student}`}
                    >
                      {answer}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic text-sm">Geen unieke antwoorden</p>
              )}
            </div>
          );
        })}
      </Card>
      </div>
    </div>
  );
}
