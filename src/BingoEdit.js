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

// Check of een specifieke vraag al is beantwoord (minstens 1 niet-leeg antwoord)
const isQuestionAnswered = (bingo, questionKey) => {
  if (!bingo || typeof bingo !== 'object') return false;
  const answers = bingo[questionKey];
  if (!Array.isArray(answers)) return false;
  return answers.some(a => a && a.trim() !== '');
};

// Check of er nog onbeantwoorde vragen zijn
const hasUnansweredQuestions = (bingo) => {
  if (!bingo || typeof bingo !== 'object') return true;
  return questionKeys.some(q => !isQuestionAnswered(bingo, q));
};

export default function BingoEdit({ selectedStudentId }) {
  const [students, setStudents, { save: saveStudents }] = useStudents();
  const student = students.find((s) => s.id === selectedStudentId);
  
  const [answers, setAnswers] = useState(createEmptyAnswers);
  
  const [saved, setSaved] = useState(false);
  
  // Check of er nog vragen zijn die niet beantwoord zijn
  const canStillEdit = hasUnansweredQuestions(student?.bingo);

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
            {canStillEdit ? 'Bingo antwoorden invullen' : 'Jouw bingo antwoorden'}
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
            {canStillEdit 
              ? 'Vul voor elke categorie 3 antwoorden in. Deze worden gebruikt om matches te vinden met andere studenten. Let op: na het opslaan kun je die antwoorden niet meer wijzigen!'
              : 'Je hebt al je antwoorden ingediend. Je kunt deze niet meer wijzigen.'
            }
          </p>
        </Card>

        <div className="space-y-4 sm:space-y-6">
          {questionKeys.map((q) => {
            // Check per vraag of deze al beantwoord is
            const questionLocked = isQuestionAnswered(student?.bingo, q);
            
            return (
            <Card key={q} title={questions[q]}>
              <div className="space-y-2">
                {questionLocked ? (
                  // Read-only weergave voor beantwoorde vragen
                  answers[q].filter(a => a.trim() !== '').length > 0 ? (
                    answers[q].filter(a => a.trim() !== '').map((answer, i) => (
                      <div key={i} className="bg-green-100 px-3 py-2 rounded text-green-800">
                        ✓ {answer}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-400 italic">Geen antwoord ingevuld</div>
                  )
                ) : (
                  // Bewerkbare invoervelden voor onbeantwoorde vragen
                  [0, 1, 2].map((i) => (
                    <TextInput
                      key={i}
                      value={answers[q][i]}
                      onChange={(value) => handleAnswerChange(q, i, value)}
                      placeholder={`Antwoord ${i + 1}`}
                      className="relative z-20"
                    />
                  ))
                )}
              </div>
            </Card>
            );
          })}
        </div>

        <div className="mt-4 sm:mt-6 flex gap-2 sm:gap-4 items-center flex-wrap">
          {canStillEdit && (
            <Button
              className="bg-indigo-600 text-white"
              onClick={handleSave}
            >
              Opslaan
            </Button>
          )}
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
