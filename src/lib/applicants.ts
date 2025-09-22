// src/lib/applicants.ts
import type { Applicant } from '@/types/applicant';

const sampleApplicants: Applicant[] = [
  {
    id: 'APP001',
    name: 'John Doe',
    email: 'john.doe@example.com',
    gpa: 3.8,
    major: 'Computer Science',
    school: 'Lake Travis High School',
    interests: 'Coding, hiking, chess',
    activities: 'Soccer, NHS, Robotics Club',
    essay: 'My journey in computer science has been driven by a passion for problem-solving...',
    transcripts: 'https://example.com/transcript.pdf',
    resume: 'https://example.com/resume.pdf',
    isBlind: false,
    firstChoiceSchool: 'University of Texas at Austin',
    firstChoiceAccepted: true,
    secondChoiceSchool: 'Texas A&M University',
    secondChoiceAccepted: false,
    thirdChoiceSchool: 'Rice University',
    thirdChoiceAccepted: true,
    fourthChoiceSchool: 'Austin Community College',
    fourthChoiceAccepted: false,
    fifthChoiceSchool: '',
    fifthChoiceAccepted: false,
    acceptanceLetter: 'https://example.com/acceptance.pdf',
    satActScore: '1450',
  },
  {
    id: 'APP002',
    name: 'Emily Smith',
    email: 'emily.smith@example.com',
    gpa: 4.0,
    major: 'Biology',
    school: 'Westlake High School',
    interests: 'Volunteering, reading, piano',
    activities: 'HOSA, Student Council, Tennis',
    essay: 'My goal is to pursue a career in medicine to help others...',
    transcripts: 'https://example.com/transcript2.pdf',
    resume: 'https://example.com/resume2.pdf',
    isBlind: true,
    firstChoiceSchool: 'Stanford University',
    firstChoiceAccepted: false,
    secondChoiceSchool: 'Johns Hopkins University',
    secondChoiceAccepted: true,
    thirdChoiceSchool: 'Baylor University',
    thirdChoiceAccepted: true,
    fourthChoiceSchool: '',
    fourthChoiceAccepted: false,
    fifthChoiceSchool: '',
    fifthChoiceAccepted: false,
    acceptanceLetter: '',
    satActScore: '34',
  },
  {
    id: 'APP003',
    name: 'Michael Johnson',
    email: 'michael.j@example.com',
    gpa: 3.5,
    major: 'Business Administration',
    school: 'Lake Travis High School',
    interests: 'Entrepreneurship, stock market, basketball',
    activities: 'DECA, FBLA, Basketball Team',
    essay: 'I am passionate about creating my own business and innovating in the market...',
    transcripts: 'https://example.com/transcript3.pdf',
    resume: 'https://example.com/resume3.pdf',
    isBlind: false,
    firstChoiceSchool: 'University of Pennsylvania',
    firstChoiceAccepted: false,
    secondChoiceSchool: 'New York University',
    secondChoiceAccepted: false,
    thirdChoiceSchool: 'University of Southern California',
    thirdChoiceAccepted: false,
    fourthChoiceSchool: '',
    fourthChoiceAccepted: false,
    fifthChoiceSchool: '',
    fifthChoiceAccepted: false,
    acceptanceLetter: '',
    satActScore: '1380',
  },
];


export async function getApplicants(): Promise<Applicant[]> {
  // Replace Firestore call with mock data
  return Promise.resolve(sampleApplicants);
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  // Replace Firestore call with mock data lookup
  const applicant = sampleApplicants.find(app => app.id === id) || null;
  return Promise.resolve(applicant);
}
