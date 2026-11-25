/* Shared descriptive content for the subject page (/fbise/12/english) and the material page (/fbise/12/english/notes/chapter-1).
   Wording is deliberately general ("typically") – it never claims a specific chapter list or official board decision. */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  var CLASS = {
    '9': { stage: 'SSC Part-I', name: 'Class 9 (SSC Part-I, Matric)' },
    '10': { stage: 'SSC Part-II', name: 'Class 10 (SSC Part-II, Matric)' },
    '11': { stage: 'HSSC Part-I', name: 'Class 11 (HSSC Part-I, Intermediate)' },
    '12': { stage: 'HSSC Part-II', name: 'Class 12 (HSSC Part-II, Intermediate)' }
  };
  var SUBJECT = {
    'physics': 'Physics is the study of matter, energy, motion, forces, waves and electricity. Good marks usually come from clear concepts, correct formulas and neatly presented numerical solutions with units.',
    'chemistry': 'Chemistry explains the structure of matter, chemical bonding, reactions and the periodic table. Learning definitions, balanced equations and the reasoning behind each reaction is the key to scoring well.',
    'biology': 'Biology covers living organisms: cells, body systems, genetics, ecology and the diversity of life. Precise scientific terms and neat, labelled diagrams are rewarded in exams.',
    'mathematics': 'Mathematics builds skills in algebra, geometry, trigonometry and, at higher classes, calculus-based topics. Regular practice and clear step-by-step working matter more than memorising answers.',
    'computer-science': 'Computer Science introduces computing concepts, programming logic, databases, networks and digital technology. Understanding the idea first and then practising small programs or exercises works best.',
    'english': 'English focuses on reading comprehension, grammar, vocabulary and writing skills such as letters, applications, essays and stories, together with the lessons of the prescribed English textbook.',
    'urdu': 'Urdu covers language and literature: prose, poetry, grammar, letter and essay writing, and the lessons of the prescribed textbook. Clear expression and correct spelling and grammar earn marks.',
    'islamiat': 'Islamiat covers the Holy Quran, Hadith, the Seerah, Islamic beliefs, worship, ethics and history. Accurate references and well-organised answers are important.',
    'pakistan-studies': 'Pakistan Studies covers the ideology, history, geography, constitution and society of Pakistan. Dates, names and clear cause-and-effect answers help in the exam.',
    'economics': 'Economics introduces how individuals, businesses and governments make choices: demand and supply, production, money, inflation and development. Definitions plus real-life examples score well.',
    'statistics': 'Statistics teaches how to collect, organise and interpret data using tables, graphs, averages, probability and measures of spread. Practising calculations step by step is essential.',
    'education': 'Education covers the principles, methods and psychology of teaching and learning. Clear definitions and practical examples help in answers.',
    'civics': 'Civics covers citizenship, rights and duties, government and community life. Short, well-structured answers with examples are best.'
  };
  var TYPE = {
    notes: {
      about: 'Chapter-wise notes are short, exam-focused summaries of each chapter: key definitions, formulas, diagrams and likely short questions. Use them for quick revision after you have read the textbook.',
      how: ['Read the textbook chapter first so the topic makes sense.', 'Use these notes to revise definitions, formulas and diagrams.', 'Write the important points in your own words from memory.', 'Test yourself with an AI quiz on this chapter.']
    },
    books: {
      about: 'Textbook PDFs let you read the prescribed book online or offline. Always treat the textbook as your main source and use notes and exercises to practise.',
      how: ['Read one lesson at a time and mark difficult parts.', 'Make your own short notes of key ideas.', 'Solve the exercise questions at the end of the lesson.', 'Ask LeemAI to explain any page you do not understand.']
    },
    exercises: {
      about: 'Exercise PDFs help you practise the questions given at the end of each chapter. Try each question yourself first and then compare your working.',
      how: ['Attempt every question on paper before looking at the PDF.', 'Compare your steps (not only the final answer).', 'Mark questions you got wrong and redo them after a day.', 'Practise similar questions with an AI quiz.']
    },
    'review-exercises': {
      about: 'Review exercises test several topics together. They are ideal for revision before tests and exams.',
      how: ['Complete the related chapters first.', 'Solve the review exercise in one sitting, like a mini test.', 'Check your answers and list weak topics.', 'Revise those topics and repeat.']
    },
    'mcqs-explanation': {
      about: 'MCQ practice with explanations helps you understand why an option is correct, not just which one. This builds speed and accuracy for the objective part of the paper.',
      how: ['Attempt the MCQs without looking at the answers.', 'Read the explanation for every answer, including the ones you got right.', 'Note repeated mistakes in a small notebook.', 'Take a timed AI quiz to check your progress.']
    },
    'past-papers': {
      about: 'Past and model papers show the style of questions and help you practise time management. Solve them under exam conditions.',
      how: ['Set a timer equal to the real paper time.', 'Solve the whole paper without help.', 'Check weak areas and revise them.', 'Upload your solved paper to the AI Paper Checker for feedback.']
    }
  };
  var DEFAULT_HOW = ['Read the PDF carefully, one page at a time.', 'Make short notes of important points.', 'Practise related questions yourself.', 'Ask LeemAI about anything you do not understand.'];

  window.SLC = {
    esc: esc,
    classInfo: function (c) { return CLASS[String(c)] || { stage: '', name: 'Class ' + c }; },
    subjectBlurb: function (slug) { return SUBJECT[slug] || 'This subject follows the Federal Board (FBISE) syllabus. Use the textbook as your main source and these PDFs for revision and practice.'; },
    typeAbout: function (type, label) { return (TYPE[type] && TYPE[type].about) || (esc(label) + ' PDFs for this subject, shared for revision and practice. Open any item to read it online.'); },
    howTo: function (type) { return (TYPE[type] && TYPE[type].how) || DEFAULT_HOW; },
    /** English part of the bilingual "English | اردو" descriptions that the auto-publisher writes. */
    english: function (d) { return String(d || '').split(' | ')[0].trim(); },
    disclaimer: function () {
      return '<div class="sl-disclaimer" role="note"><h2>Disclaimer</h2>' +
        '<p>StudyLeem is an independent educational website. It is <b>not affiliated with, endorsed by or officially connected to the Federal Board of Intermediate and Secondary Education (FBISE)</b> or any government body.</p>' +
        '<p>All study materials are shared for educational reference only and are not for sale or commercial use. Textbooks and other official content remain the property of their respective authors and publishers. ' +
        'Notes, summaries, AI answers and estimated marks may contain mistakes – always check the official textbook, syllabus, date sheet and notifications on the FBISE website.</p>' +
        '<p>If you are a copyright owner and want any item removed, please <a href="/contact">contact us</a> and we will act promptly. See also our <a href="/terms">Terms of Use</a> and <a href="/privacy">Privacy Policy</a>.</p></div>';
    },
    /** Keep the class/subject the student is looking at when they open LeemAI. */
    setLeemaiContext: function (cls, subject) {
      try { localStorage.setItem('sl_ctx', JSON.stringify({ cls: String(cls), subject: subject || 'all' })); } catch (e) {}
    }
  };
  // links with data-lm-class / data-lm-subject set LeemAI's class + subject before navigating
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-lm-class]');
    if (a) window.SLC.setLeemaiContext(a.getAttribute('data-lm-class'), a.getAttribute('data-lm-subject'));
  });
})();
