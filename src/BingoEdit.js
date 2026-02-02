import React, { useState, useEffect } from 'react';
import { questions } from './bingoData';
import useStudents from './hooks/useStudents';
import { Button, TextInput, Card } from './components/ui';
import { getImageUrl } from './supabase';

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

export default function BingoEdit({ selectedStudentId }) {
  const [students, setStudents, { save: saveStudents }] = useStudents();
  const student = students.find((s) => s.id === selectedStudentId);
  
  const [answers, setAnswers] = useState(createEmptyAnswers);
  
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (student?.bingo) {
      const newAnswers = {};
      questionKeys.forEach(q => {
        newAnswers[q] = [...(student.bingo[q] || []), '', '', ''].slice(0, 3);
      });
      setAnswers(newAnswers);
    } else {
      setAnswers(createEmptyAnswers());
    }
  }, [student]);

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
  };

  if (!student) {
    return (
      <div className="relative min-h-screen">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <img src={getImageUrl('voorpagina.png')} alt="Background" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-10 p-4 max-w-2xl mx-auto">
          <Card title="Bingo antwoorden">
            <p>Je moet ingelogd zijn om je bingo-antwoorden in te vullen.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      {/* Background image */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img src={getImageUrl('voorpagina.png')} alt="Background" className="w-full h-full object-cover" />
      </div>

      {/* Main content */}
      <div className="relative z-10 p-2 sm:p-4 max-w-2xl mx-auto">
        <div className="mb-4 flex flex-col gap-2 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg sm:text-xl font-semibold bg-white/90 px-3 py-1 rounded">
            Bingo antwoorden invullen/bewerken
          </h2>
          <Button
            className="bg-gray-600 text-white"
            onClick={() => window.location.hash = '/student'}
          >
            Overzicht
          </Button>
        </div>

        <Card className="mb-4 sm:mb-6">
          <p className="text-xs sm:text-sm text-gray-600">
            Vul voor elke categorie 3 antwoorden in. Je kunt je antwoorden later altijd terugzien en aanpassen.
          </p>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          {questionKeys.map((q) => {
            return (
            <Card key={q} title={questions[q]}>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <TextInput
                    key={i}
                    value={answers[q][i]}
                    onChange={(value) => handleAnswerChange(q, i, value)}
                    placeholder={`Antwoord ${i + 1}`}
                    className="relative z-20"
                  />
                ))}
              </div>
            </Card>
            );
          })}
        </div>

        <div className="mt-4 sm:mt-6 flex gap-2 sm:gap-4 items-center flex-wrap">
          <Button
            className="bg-indigo-600 text-white"
            onClick={handleSave}
          >
            Opslaan
          </Button>
          {saved && <span className="text-green-600 bg-white/90 px-2 py-1 rounded text-sm">✓ Opgeslagen!</span>}
          <Button
            className="bg-emerald-600 text-white"
            onClick={() => window.location.hash = '/bingo'}
          >
            Naar Bingo spel
          </Button>
        </div>
      </div>
    </div>
  );
}
