import { getImageUrl } from './supabase';

export const BADGE_DEFS = [
  { id: 'eeg', title: 'EEG', image: getImageUrl('eeg.jpg'), requirement: '' },
  { id: 'eeg2', title: 'EEG2', image: getImageUrl('eeg2.webp'), requirement: '' },
  { id: 'experiment', title: 'Experiment', image: getImageUrl('experiment.webp'), requirement: '' },
  { id: 'facereader', title: 'Facereader', image: getImageUrl('facereader.webp'), requirement: '' },
  { id: 'excursie', title: 'Excursie', image: getImageUrl('excursie.webp'), requirement: '' },
  { id: 'groupname', title: 'Groepsnaam & mascotte', image: getImageUrl('groupname.webp'), requirement: '' },
  { id: 'homework', title: 'Homework', image: getImageUrl('homework.webp'), requirement: '' },
  { id: 'kennistoets', title: 'Kennistoets', image: getImageUrl('kennistoets.webp'), requirement: '' },
  { id: 'leeswerk', title: 'Leeswerk', image: getImageUrl('leeswerk.webp'), requirement: '' },
  { id: 'lunch', title: 'Lunch', image: getImageUrl('lunch.webp'), requirement: '' },
  { id: 'meeting', title: 'Meeting with commissioner', image: getImageUrl('meeting.webp'), requirement: '' },
  { id: 'minorbehaald', title: 'Minor behaald', image: getImageUrl('minorbehaald.webp'), requirement: '' },
  { id: 'namen', title: 'Namen badge', image: getImageUrl('namen-badge.webp'), requirement: '' },
  { id: 'partycommittee', title: 'Party committee', image: getImageUrl('partycommittee.webp'), requirement: '' },
  { id: 'project', title: 'Project', image: getImageUrl('project.webp'), requirement: '' },
  { id: 'pubquiz', title: 'Pubquiz', image: getImageUrl('pubquiz.webp'), requirement: '' },
  { id: 'pupil-labs', title: 'Pupil labs', image: getImageUrl('pupil-labs.webp'), requirement: '' },
];
