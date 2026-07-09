'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useFirebase, useAuth, initiatePasswordReset } from '@/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Check, Copy, ExternalLink, Loader2, FlaskConical, Users, ShieldAlert, Mail } from 'lucide-react';
import Link from 'next/link';

export default function TestUtilsPage() {
  const { firestore } = useFirebase();
  const auth = useAuth();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isResetting, setIsResetting] = useState<Record<string, boolean>>({});
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const handlePasswordReset = async (email: string) => {
    if (!auth) return;
    setIsResetting(prev => ({ ...prev, [email]: true }));
    try {
      await initiatePasswordReset(auth, email);
      toast({
        title: "Reset Link Dispatched",
        description: `Official Firebase recovery email sent to ${email}.`,
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Reset Failed",
        description: err.message,
      });
    } finally {
      setIsResetting(prev => ({ ...prev, [email]: false }));
    }
  };

  const createTestToken = async () => {
    if (!firestore) return;
    setIsCreating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const docRef = await addDoc(collection(firestore, 'recommendationTokens'), {
        studentName: "Test Student",
        scholarshipTitle: "Test Scholarship",
        recommenderName: "Test Teacher",
        recommenderEmail: "test@test.com",
        applicationId: "test-application-id",
        organizationId: "scholarship-hib4j",
        used: false,
        expiresAt,
        createdAt: serverTimestamp()
      });

      setCreatedToken(docRef.id);
      toast({ 
        title: "Test Token Created", 
        description: "A secure upload token has been added to Firestore." 
      });
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Failed to create test document.", 
        variant: "destructive" 
      });
    } finally {
      setIsCreating(false);
    }
  };

  const seedDemoApplications = async () => {
    if (!firestore) return;
    setIsSeeding(true);
    
    const students = [
      {
        name: "Maya Rodriguez",
        email: "m.rodriguez@student.edu",
        school: "Westlake High School",
        gpa: 3.85,
        essay1: "My primary academic goal is to pursue a degree in Biomedical Engineering. Growing up in a community with limited access to advanced healthcare, I saw firsthand how technology can bridge the gap between diagnosis and recovery. This scholarship will allow me to focus entirely on my research regarding low-cost prosthetic limbs during my freshman year at UT Austin. My long-term vision involves returning to underserved areas to implement sustainable medical technologies that are both affordable and life-changing for patients with physical disabilities.",
        essay2: "Moving to Texas from a small town meant adapting to a much larger, more competitive academic environment. Initially, I felt overwhelmed by the pace of advanced placement courses. However, I learned to leverage peer study groups and seek mentorship from my chemistry teacher. This experience taught me that vulnerability is a strength in learning. I transformed my initial anxiety into a structured approach to problem-solving, eventually graduating in the top 5% of my class while balancing a part-time job at a local pharmacy.",
        recommender: "Dr. Elena Vance",
        title: "AP Biology Lead"
      },
      {
        name: "James Washington",
        email: "james.wash.25@gmail.com",
        school: "Bellaire High School",
        gpa: 3.42,
        essay1: "I am committed to studying Civil Engineering with a focus on urban infrastructure. My goal is to design cities that are more resilient to climate change, specifically focusing on flood prevention systems in coastal regions. This scholarship will help cover the costs of specialized software and laboratory fees required for my degree. By alleviating financial pressure, I can dedicate my summers to internships with the Army Corps of Engineers, gaining the practical experience necessary to lead large-scale public works projects in the future.",
        essay2: "During my junior year, I was named captain of the varsity wrestling team. Mid-season, our program faced significant budget cuts that threatened our ability to travel for regional qualifiers. Instead of accepting defeat, I organized a community-wide athletic clinic for middle schoolers to raise funds. We didn't just meet our goal; we exceeded it, fostering a new partnership with local businesses. This challenge taught me that leadership isn't just about performance on the mat, but about rallying a community around a shared objective during times of scarcity.",
        recommender: "Coach Mike Miller",
        title: "Athletic Director"
      },
      {
        name: "Priya Patel",
        email: "p.patel.tech@outlook.com",
        school: "Coppell High School",
        gpa: 3.98,
        essay1: "My academic journey is defined by a passion for Computer Science and Ethics. I want to build AI systems that are not only efficient but also free from algorithmic bias. This scholarship is critical because it will allow me to participate in the 'Ethical AI' seminar series at Stanford, which is outside my standard tuition coverage. My goal is to ensure that the next generation of digital tools serves a diverse global population fairly, protecting the rights and dignity of all users regardless of their background.",
        essay2: "A significant challenge I overcame was the language barrier my family faced when we first arrived in the United States. While my parents worked long hours, I often acted as the primary translator for complex legal and medical documents at a young age. This responsibility forced me to grow up quickly and develop a high level of empathy and communication skills. It taught me that information is the most powerful tool for empowerment, and it sparked my desire to build technology that simplifies complex systems for everyday people.",
        recommender: "Sarah Jenkins",
        title: "Computer Science Dept Chair"
      },
      {
        name: "Connor Murphy",
        email: "connor.murphy25@student.org",
        school: "Highland Park High School",
        gpa: 3.25,
        essay1: "I plan to study International Business with a minor in Mandarin Chinese. I believe that global trade is the most effective way to foster peaceful relations between nations. This scholarship will assist with my study abroad expenses in Shanghai next spring. My goal is to work for a multinational firm where I can utilize my cross-cultural communication skills to negotiate trade agreements that benefit developing economies while maintaining sustainable environmental standards across all supply chains.",
        essay2: "Throughout my early education, I struggled with severe dyslexia. Reading was a slow, painful process that made me feel inferior to my peers. However, with the help of a dedicated learning specialist, I learned to see my dyslexia not as a disability, but as a different way of processing information. I developed unique mnemonic devices and visual mapping techniques that now allow me to grasp complex business models faster than many of my classmates. I've learned that perseverance and creative adaptation are the keys to overcoming any systemic barrier.",
        recommender: "Robert Zhao",
        title: "Economics Instructor"
      },
      {
        name: "Aaliyah Johnson",
        email: "a.johnson.leads@edu.org",
        school: "South Oak Cliff High School",
        gpa: 3.67,
        essay1: "My academic focus is on Political Science and Public Policy. I intend to become a legislative advocate for educational equity in urban districts. This scholarship will support my living expenses during a non-paid internship at the Texas State Capitol. By working directly with policymakers, I will learn the mechanics of bill drafting and coalition building. My ultimate goal is to return to my home district to implement policies that provide every student, regardless of their zip code, with access to high-quality extracurricular programming.",
        essay2: "In my sophomore year, our school's debate club was nearly disbanded due to a lack of faculty sponsorship. Recognizing the importance of this space for critical thinking, I spent three months petitioning the school board and interviewing local community leaders to find a volunteer mentor. We eventually secured a retired judge to lead the team. Under my leadership as president, we went on to win the state championship. This taught me that systemic change starts with individual initiative and the courage to ask for support from those who have walked the path before you.",
        recommender: "Hon. Marcus Reed",
        title: "Community Mentor"
      }
    ];

    try {
      const orgId = "scholarship-hib4j";
      const scholarshipId = "academic-excellence";
      const reviewerId = "vj3d8Nz7O5QA1XXlK5QtCj03OZF2";

      for (const student of students) {
        const appData = {
          studentName: student.name,
          studentEmail: student.email,
          school: student.school,
          schoolId: orgId,
          organizationId: orgId,
          scholarshipId: scholarshipId,
          gpa: student.gpa,
          graduationYear: 2025,
          major: "General Studies",
          interests: "Academics, Leadership",
          activities: "Student Government, Clubs",
          status: "Submitted",
          submittedAt: serverTimestamp(),
          reviewerIds: [reviewerId],
          essays: [
            {
              promptId: "prompt1",
              promptText: "Describe your academic goals and how this scholarship will help you achieve them.",
              response: student.essay1
            },
            {
              promptId: "prompt2",
              promptText: "Describe a challenge you have overcome and what you learned from it.",
              response: student.essay2
            }
          ],
          recommendations: [
            {
              recommenderName: student.recommender,
              recommenderTitle: student.title,
              status: "Received"
            }
          ],
          recsReceived: 1,
          recsRequired: 1,
          scores: [],
          averageScore: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        // Add to hierarchical path
        await addDoc(collection(firestore, 'organizations', orgId, 'scholarships', scholarshipId, 'applications'), appData);
        
        // Also add to primary users collection to satisfy dashboard queries
        await addDoc(collection(firestore, 'users'), {
          ...appData,
          role: 'applicant',
          name: student.name,
          email: student.email,
          status: 'submitted'
        });
      }

      toast({ 
        title: "Seeding Complete", 
        description: "5 demo applications have been added to the reviewer queue." 
      });
    } catch (err: any) {
      toast({ 
        title: "Seed Failed", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setIsSeeding(false);
    }
  };

  const copyUrl = () => {
    if (!createdToken) return;
    const url = `${window.location.origin}/recommend/${createdToken}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied", description: "Recommender portal URL copied to clipboard." });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Platform Utilities</h1>
        <p className="text-muted-foreground italic flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-primary" />
          Internal tools for verifying platform workflows and credential integrity.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg">Recommendation Portal</CardTitle>
            <CardDescription>
              Generate a mock recommendation token to test the secure public upload portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={createTestToken} disabled={isCreating} className="w-full">
              {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              {isCreating ? 'Creating Entry...' : 'Generate Test Token'}
            </Button>

            {createdToken && (
              <div className="p-4 rounded-xl border border-green-200 bg-green-50/50 space-y-3 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-700 font-bold text-xs">
                    <Check className="h-4 w-4" /> Token ID: {createdToken}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={copyUrl} className="h-8 text-[10px] bg-white">
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                    <Button variant="default" size="sm" asChild className="h-8 text-[10px]">
                      <Link href={`/recommend/${createdToken}`} target="_blank">
                        <ExternalLink className="h-3 w-3 mr-1" /> Open
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/5">
          <CardHeader>
            <CardTitle className="text-lg">Demo Application Seeding</CardTitle>
            <CardDescription>
              Populate the database with realistic student applications for reviewer testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={seedDemoApplications} disabled={isSeeding} variant="secondary" className="w-full border-blue-200 bg-blue-100 hover:bg-blue-200 text-blue-700">
              {isSeeding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Users className="mr-2 h-4 w-4" />}
              {isSeeding ? 'Seeding Database...' : 'Seed 5 Demo Applications'}
            </Button>
            <p className="text-[9px] text-muted-foreground text-center italic">
              Apps will be assigned to: vj3d8Nz7O5QA1XXlK5QtCj03OZF2
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Test Account Management
            </CardTitle>
            <CardDescription>
              Trigger official Firebase recovery workflows for standard test accounts.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-xl border bg-card flex flex-col justify-between gap-4">
              <div>
                <p className="text-sm font-bold">Reviewer Test Account</p>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">reviewer@test.com</code>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-fit"
                disabled={isResetting['reviewer@test.com']}
                onClick={() => handlePasswordReset('reviewer@test.com')}
              >
                {isResetting['reviewer@test.com'] ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Mail className="h-3 w-3 mr-2 text-amber-600" />}
                Send Reset Link
              </Button>
            </div>
            <div className="p-4 rounded-xl border bg-card flex flex-col justify-between gap-4">
              <div>
                <p className="text-sm font-bold">Admin Test Account</p>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">admin@test.com</code>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="w-fit"
                disabled={isResetting['admin@test.com']}
                onClick={() => handlePasswordReset('admin@test.com')}
              >
                {isResetting['admin@test.com'] ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <Mail className="h-3 w-3 mr-2 text-amber-600" />}
                Send Reset Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
