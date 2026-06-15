'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

interface ResumeAnalysis {
  overallScore: number;
  atsScore: number;
  strengths: string[];
  weaknesses: string[];
  missingSkills: string[];
  suggestions: string[];
}

interface AnalysisHistoryItem {
  score: number;
  strengths: string[];
  weaknesses: string[];
  analyzedAt: string;
}

interface ResumeVersion {
  _id: string;
  title: string;
  targetRole?: string;
  template: 'modern' | 'professional' | 'minimal';
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    website?: string;
    linkedin?: string;
    github?: string;
  };
  summary: string;
  education: Array<{
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    gpa?: string;
  }>;
  experience: Array<{
    company: string;
    position: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string[];
  }>;
  projects: Array<{
    title: string;
    role: string;
    technologies: string[];
    link?: string;
    description: string[];
  }>;
  skills: string[];
  certifications: string[];
  isPrimary: boolean;
  lastScore: number;
  analysisHistory: AnalysisHistoryItem[];
  updatedAt: string;
}

export default function ResumePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Tab: 'upload' | 'builder'
  const [activeTab, setActiveTab] = useState<'upload' | 'builder'>('upload');

  // Existing Resume Upload State
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Genie Advisor Interactive Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ sender: 'ai' | 'user'; message: string }>>([
    { sender: 'ai', message: 'Hello! I am Genie, your AI Career Advisor. Ask me anything about tailoring or optimizing your resume for top tech roles!' }
  ]);
  const [chatSending, setChatSending] = useState(false);

  // Resume Builder States
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null);
  const [activeVersion, setActiveVersion] = useState<ResumeVersion | null>(null);

  // Editor specific states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTargetRole, setNewTargetRole] = useState('');
  const [newTemplate, setNewTemplate] = useState<'modern' | 'professional' | 'minimal'>('modern');

  // AI Assist loading indicators
  const [summaryRewriting, setSummaryRewriting] = useState(false);
  const [bulletImproving, setBulletImproving] = useState<{ [key: string]: boolean }>({});
  const [verbsLoading, setVerbsLoading] = useState<{ [key: string]: boolean }>({});
  const [suggestedVerbs, setSuggestedVerbs] = useState<{ [key: string]: string[] }>({});
  const [recalculatingAI, setRecalculatingAI] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);

  // Auto-save debouncing ref
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth');
    } else if (user) {
      if (user.role !== 'student') {
        router.push('/dashboard');
      } else {
        loadResumeData();
        loadVersions();
      }
    }
  }, [user, authLoading, router]);

  // Handle Recalculate Cooldown Countdown Timer
  useEffect(() => {
    if (cooldownRemaining === null) return;
    if (cooldownRemaining <= 0) {
      setCooldownRemaining(null);
      return;
    }
    const timer = setTimeout(() => {
      setCooldownRemaining(cooldownRemaining - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  const loadResumeData = async () => {
    setLoading(true);
    setError(null);
    try {
      const resumeRes = await fetch('/api/resumes');
      if (resumeRes.ok) {
        const resumeData = await resumeRes.json();
        setFileUrl(resumeData.resume?.fileUrl);

        const analysisRes = await fetch('/api/resumes/analysis');
        if (analysisRes.ok) {
          const analysisData = await analysisRes.json();
          setAnalysis(analysisData.analysis);
        }
      }
    } catch (err) {
      console.error('Error fetching resume info:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVersions = async () => {
    setBuilderLoading(true);
    try {
      const res = await fetch('/api/resume-versions');
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Error loading resume versions:', err);
    } finally {
      setBuilderLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Resume Builder API actions
  // -------------------------------------------------------------
  const handleCreateVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch('/api/resume-versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          targetRole: newTargetRole,
          template: newTemplate,
          personalInfo: { name: user?.name || '', email: user?.email || '', phone: '' }
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setVersions([data.version, ...versions]);
        setShowCreateModal(false);
        setNewTitle('');
        setNewTargetRole('');
        setNewTemplate('modern');
        // Open in editor
        handleEditVersion(data.version);
      }
    } catch (err) {
      console.error('Failed to create version:', err);
    }
  };

  const handleEditVersion = (version: ResumeVersion) => {
    setActiveVersionId(version._id);
    setActiveVersion(JSON.parse(JSON.stringify(version))); // Deep copy
  };

  const handleDuplicateVersion = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/resume-versions/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setVersions([data.version, ...versions]);
      }
    } catch (err) {
      console.error('Failed to duplicate version:', err);
    }
  };

  const handleDeleteVersion = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this resume version?')) return;
    try {
      const res = await fetch(`/api/resume-versions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVersions(versions.filter(v => v._id !== id));
        if (activeVersionId === id) {
          setActiveVersionId(null);
          setActiveVersion(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete version:', err);
    }
  };

  const handleSetPrimary = async (e: React.MouseEvent | React.FormEvent | null | undefined, id: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setBuilderLoading(true);
    try {
      const res = await fetch(`/api/resume-versions/${id}/set-primary`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        // Update local list
        setVersions(versions.map(v => ({
          ...v,
          isPrimary: v._id === id,
          lastScore: v._id === id ? data.version.lastScore : v.lastScore,
          analysisHistory: v._id === id ? data.version.analysisHistory : v.analysisHistory
        })));
        if (activeVersion && activeVersion._id === id) {
          setActiveVersion(data.version);
        }
        alert('Resume version has been set as primary and synced to ATS matching dashboard.');
        // Refresh upload info in background
        loadResumeData();
      }
    } catch (err) {
      console.error('Failed to set primary version:', err);
    } finally {
      setBuilderLoading(false);
    }
  };

  const handleRecalculateAI = async () => {
    if (!activeVersion) return;
    setRecalculatingAI(true);
    setError(null);
    try {
      const res = await fetch(`/api/resume-versions/${activeVersion._id}/recalculate`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setActiveVersion(data.version);
        setVersions(versions.map(v => v._id === activeVersion._id ? data.version : v));
      } else if (res.status === 429) {
        const data = await res.json();
        setCooldownRemaining(data.cooldownRemaining || 30);
        setError(data.error);
      } else {
        setError('Failed to run AI recalculation.');
      }
    } catch (err) {
      console.error('AI recalculation error:', err);
      setError('Connection failure during AI recalculation.');
    } finally {
      setRecalculatingAI(false);
    }
  };

  const handleSaveActiveVersion = async (updated: ResumeVersion) => {
    try {
      const res = await fetch(`/api/resume-versions/${updated._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        const data = await res.json();
        // Update lists
        setVersions(prev => prev.map(v => v._id === updated._id ? data.version : v));
      }
    } catch (err) {
      console.error('Failed to save version updates:', err);
    }
  };

  // Debounced change handler for fields
  const handleFieldChange = (updated: ResumeVersion) => {
    setActiveVersion(updated);

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSaveActiveVersion(updated);
    }, 1500);
  };

  // -------------------------------------------------------------
  // AI Assist helper calls
  // -------------------------------------------------------------
  const handleRewriteSummary = async (tone: string) => {
    if (!activeVersion || !activeVersion.summary) return;
    setSummaryRewriting(true);
    try {
      const res = await fetch('/api/resume-versions/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rewrite_summary',
          summary: activeVersion.summary,
          targetRole: activeVersion.targetRole,
          tone
        })
      });
      if (res.ok) {
        const data = await res.json();
        const updated = { ...activeVersion, summary: data.rewrittenSummary };
        handleFieldChange(updated);
      }
    } catch (err) {
      console.error('Failed to rewrite summary:', err);
    } finally {
      setSummaryRewriting(false);
    }
  };

  const handleImproveBullet = async (index: number, type: 'experience' | 'projects', bulletIndex: number) => {
    if (!activeVersion) return;
    const key = `${type}-${index}-${bulletIndex}`;
    setBulletImproving(prev => ({ ...prev, [key]: true }));

    const bulletPoint = type === 'experience'
      ? activeVersion.experience[index].description[bulletIndex]
      : activeVersion.projects[index].description[bulletIndex];

    const jobTitle = type === 'experience'
      ? activeVersion.experience[index].position
      : activeVersion.projects[index].role;

    try {
      const res = await fetch('/api/resume-versions/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'improve_bullet',
          bulletPoint,
          jobTitle,
          targetRole: activeVersion.targetRole
        })
      });
      if (res.ok) {
        const data = await res.json();
        const updated = { ...activeVersion };
        if (type === 'experience') {
          updated.experience[index].description[bulletIndex] = data.improvedBulletPoint;
        } else {
          updated.projects[index].description[bulletIndex] = data.improvedBulletPoint;
        }
        handleFieldChange(updated);
      }
    } catch (err) {
      console.error('Failed to improve bullet point:', err);
    } finally {
      setBulletImproving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSuggestVerbs = async (index: number, type: 'experience' | 'projects', bulletIndex: number) => {
    if (!activeVersion) return;
    const key = `${type}-${index}-${bulletIndex}`;
    setVerbsLoading(prev => ({ ...prev, [key]: true }));

    const bulletPoint = type === 'experience'
      ? activeVersion.experience[index].description[bulletIndex]
      : activeVersion.projects[index].description[bulletIndex];

    try {
      const res = await fetch('/api/resume-versions/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'suggest_verbs',
          bulletPoint
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSuggestedVerbs(prev => ({ ...prev, [key]: data.verbs }));
      }
    } catch (err) {
      console.error('Failed to suggest verbs:', err);
    } finally {
      setVerbsLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // -------------------------------------------------------------
  // Client-side Live Score calculation
  // -------------------------------------------------------------
  const getLiveScoreDetails = (v: ResumeVersion | null) => {
    if (!v) return { score: 0, strengths: [], missing: [] };
    
    let score = 0;
    const strengths: string[] = [];
    const missing: string[] = [];

    // 1. Personal Info
    let pInfoCount = 0;
    if (v.personalInfo?.name) pInfoCount++;
    if (v.personalInfo?.email) pInfoCount++;
    if (v.personalInfo?.phone) pInfoCount++;
    if (v.personalInfo?.linkedin) pInfoCount++;
    if (v.personalInfo?.github) pInfoCount++;
    score += pInfoCount * 3;
    if (pInfoCount >= 4) {
      strengths.push("Comprehensive contact details provided.");
    } else {
      missing.push("LinkedIn or GitHub links (highly recommended).");
    }

    // 2. Summary
    if (v.summary && v.summary.trim().length > 30) {
      score += 15;
      strengths.push("Professional summary is detailed and clear.");
    } else {
      missing.push("A strong professional summary statement.");
    }

    // 3. Experience
    const expCount = v.experience?.length || 0;
    score += Math.min(expCount * 8, 25);
    if (expCount > 0) {
      strengths.push(`Includes ${expCount} relevant professional experience entry/entries.`);
      let hasBullets = false;
      let hasMetrics = false;
      v.experience.forEach((exp) => {
        if (exp.description?.length > 0) hasBullets = true;
        (exp.description || []).forEach((desc) => {
          if (/\d+/.test(desc)) hasMetrics = true;
        });
      });
      if (hasBullets) {
        strengths.push("Professional experience includes detailed bullet points.");
      } else {
        missing.push("Bullet points explaining job duties and impact.");
      }
      if (hasMetrics) {
        strengths.push("Quantified achievements using metrics and percentages.");
      } else {
        missing.push("Quantifiable metrics/results in experience description.");
      }
    } else {
      missing.push("Professional work experience entries.");
    }

    // 4. Projects
    const projCount = v.projects?.length || 0;
    score += Math.min(projCount * 10, 20);
    if (projCount > 0) {
      strengths.push(`Highlights ${projCount} portfolio project(s).`);
    } else {
      missing.push("Academic or personal project showcases.");
    }

    // 5. Skills
    const skillsCount = v.skills?.length || 0;
    score += Math.min(skillsCount * 1.5, 15);
    if (skillsCount >= 5) {
      strengths.push("Good coverage of technical and professional skills.");
    } else {
      missing.push("A dedicated list of 5+ key skills.");
    }

    // 6. Certifications & Education
    const eduCount = v.education?.length || 0;
    const certCount = v.certifications?.length || 0;
    if (eduCount > 0) score += 5;
    if (certCount > 0) score += 5;
    if (eduCount > 0) strengths.push("Education credentials listed.");
    else missing.push("Education background.");

    // Target role specific check
    if (v.targetRole) {
      const roleLower = v.targetRole.toLowerCase();
      let expectedSkills: string[] = [];
      if (roleLower.includes("front") || roleLower.includes("react")) {
        expectedSkills = ["react", "javascript", "typescript", "css", "html"];
      } else if (roleLower.includes("back") || roleLower.includes("node")) {
        expectedSkills = ["node.js", "express", "mongodb", "postgresql", "docker", "aws"];
      } else if (roleLower.includes("full") || roleLower.includes("stack")) {
        expectedSkills = ["react", "node.js", "mongodb", "sql", "git", "docker", "aws"];
      } else if (roleLower.includes("data") || roleLower.includes("python")) {
        expectedSkills = ["python", "sql", "pandas", "machine learning", "tableau"];
      } else if (roleLower.includes("design") || roleLower.includes("figma") || roleLower.includes("ui")) {
        expectedSkills = ["figma", "ui", "ux", "wireframing", "prototyping"];
      }

      if (expectedSkills.length > 0) {
        const userSkillsLower = (v.skills || []).map(s => s.toLowerCase().trim());
        const missingRoleSkills = expectedSkills.filter(s => !userSkillsLower.includes(s));
        if (missingRoleSkills.length > 0) {
          missing.push(`Role-specific keywords missing: ${missingRoleSkills.join(", ")}`);
        } else {
          strengths.push(`Fully covers standard keywords for ${v.targetRole}.`);
        }
      }
    }

    return {
      score: Math.min(Math.round(score), 100),
      strengths,
      missing
    };
  };

  const liveDetails = getLiveScoreDetails(activeVersion);

  // -------------------------------------------------------------
  // Export actions
  // -------------------------------------------------------------
  const handleDownloadTxt = () => {
    if (!activeVersion) return;
    const compileResumeTextLocal = (version: ResumeVersion) => {
      let text = `Name: ${version.personalInfo?.name || ''}\n`;
      text += `Email: ${version.personalInfo?.email || ''}\n`;
      text += `Phone: ${version.personalInfo?.phone || ''}\n`;
      if (version.personalInfo?.linkedin) text += `LinkedIn: ${version.personalInfo.linkedin}\n`;
      if (version.personalInfo?.github) text += `GitHub: ${version.personalInfo.github}\n`;
      if (version.personalInfo?.website) text += `Website: ${version.personalInfo.website}\n\n`;
      
      text += `Summary:\n${version.summary || ''}\n\n`;
      
      text += `Education:\n`;
      (version.education || []).forEach((edu) => {
        text += `- ${edu.institution || ''}: ${edu.degree || ''} in ${edu.fieldOfStudy || ''} (${edu.startDate || ''} - ${edu.endDate || ''}) ${edu.gpa ? `GPA: ${edu.gpa}` : ''}\n`;
      });
      text += `\n`;
      
      text += `Experience:\n`;
      (version.experience || []).forEach((exp) => {
        text += `- ${exp.position || ''} at ${exp.company || ''} (${exp.startDate || ''} - ${exp.endDate || ''})\n`;
        (exp.description || []).forEach((bullet) => {
          text += `  * ${bullet}\n`;
        });
      });
      text += `\n`;
      
      text += `Projects:\n`;
      (version.projects || []).forEach((proj) => {
        text += `- ${proj.title || ''} (${proj.role || ''}): ${proj.technologies?.join(', ') || ''}\n`;
        (proj.description || []).forEach((bullet) => {
          text += `  * ${bullet}\n`;
        });
      });
      text += `\n`;
      
      text += `Skills: ${version.skills?.join(', ') || ''}\n\n`;
      text += `Certifications: ${version.certifications?.join(', ') || ''}\n`;
      return text;
    };

    const text = compileResumeTextLocal(activeVersion);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeVersion.title.replace(/\s+/g, '_')}_resume.txt`;
    link.click();
  };

  const handlePrintPdf = () => {
    window.print();
  };

  // -------------------------------------------------------------
  // File upload logic (retained)
  // -------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processFile(files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = (file: File) => {
    setUploadProgress(true);
    setError(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch('/api/resumes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64,
            text: `Extracted Resume: Candidate name ${user?.name}. Experienced in Full Stack Web Development using JavaScript, React, Node.js, Express, CSS, and database designs. Seeking engineering internship or new grad positions.`,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setFileUrl(data.resume?.fileUrl);
          setAnalysis(data.analysis);
          setChatHistory((prev) => [
            ...prev,
            { sender: 'ai', message: `Resume processed successfully! I analyzed your profile and calculated an ATS optimization score of ${data.analysis?.atsScore || 80}%. What questions do you have?` }
          ]);
        } else {
          const errData = await res.json();
          setError(errData.error || 'Failed to upload/analyze resume.');
        }
      } catch (err) {
        setError('Error uploading file. Please try again.');
      } finally {
        setUploadProgress(false);
      }
    };
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatHistory((prev) => [...prev, { sender: 'user', message: userMsg }]);
    setChatInput('');
    setChatSending(true);

    try {
      const response = await fetch('/api/resumes/analysis');
      let systemSuggestion = 'That is an excellent point. I recommend focusing on highlighting your project achievements and concrete metrics.';
      if (response.ok) {
        const data = await response.json();
        const score = data.analysis?.overallScore || 80;
        if (userMsg.toLowerCase().includes('score') || userMsg.toLowerCase().includes('ats')) {
          systemSuggestion = `Your resume currently scores ${score}/100. Adding key missing skills like Docker or Kubernetes would raise this significantly.`;
        } else if (userMsg.toLowerCase().includes('skill') || userMsg.toLowerCase().includes('missing')) {
          systemSuggestion = `I noticed you are missing ${data.analysis?.missingSkills?.join(', ') || 'Docker, AWS'}. Highlighting these in your professional experience will match you with 40% more jobs!`;
        } else if (userMsg.toLowerCase().includes('strength') || userMsg.toLowerCase().includes('weak')) {
          systemSuggestion = `Your main strength is: ${data.analysis?.strengths?.[0] || 'Leadership and ownership'}. Your area of improvement is: ${data.analysis?.weaknesses?.[0] || 'Lack of quantifiable metrics'}.`;
        }
      }

      setTimeout(() => {
        setChatHistory((prev) => [...prev, { sender: 'ai', message: systemSuggestion }]);
        setChatSending(false);
      }, 800);
    } catch (err) {
      setChatHistory((prev) => [...prev, { sender: 'ai', message: 'I ran into a connection error. How else can I assist you with your career planning?' }]);
      setChatSending(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="pt-24 px-gutter pb-xl max-w-max-width mx-auto">
      {/* Hide page contents during standard print layout so only print resume compiles */}
      <div className="print:hidden">
        {/* Top Header Section */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-md mb-xl text-left border-b border-outline-variant pb-md">
          <div>
            <h1 className="font-display-lg text-4xl text-on-surface mb-xs font-black">Resume Management Hub</h1>
            <p className="font-body-lg text-on-surface-variant">
              Upload existing resumes or build tailored, ATS-optimized, named versions for target jobs.
            </p>
          </div>
          <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant">
            <button
              onClick={() => { setActiveTab('upload'); setActiveVersionId(null); setActiveVersion(null); }}
              className={`px-lg py-md rounded-lg font-label-md text-label-md font-bold transition-all ${activeTab === 'upload' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Resume Upload & ATS Report
            </button>
            <button
              onClick={() => setActiveTab('builder')}
              className={`px-lg py-md rounded-lg font-label-md text-label-md font-bold transition-all ${activeTab === 'builder' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              Interactive Resume Builder
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-lg p-md bg-error-container text-error rounded-xl text-body-sm font-semibold flex items-center gap-sm">
            <span className="material-symbols-outlined text-md">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* ----------------- TAB 1: RESUME UPLOAD ----------------- */}
        {activeTab === 'upload' && (
          <>
            {/* Upload Zone */}
            <section className="mb-2xl">
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                className="relative group cursor-pointer border-2 border-dashed border-outline-variant hover:border-primary bg-surface-container-lowest rounded-2xl p-2xl text-center hover:bg-primary/5 transition-all duration-300"
              >
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-md shadow-sm">
                    <span className="material-symbols-outlined text-[32px]">upload_file</span>
                  </div>
                  <h3 className="font-headline-lg text-headline-lg text-on-surface mb-sm font-bold">
                    {uploadProgress ? 'Processing Document...' : 'Drop your resume here'}
                  </h3>
                  <p className="text-on-surface-variant mb-lg font-body-sm">
                    {fileUrl ? 'Already uploaded a resume. Uploading again will overwrite it.' : 'Support for PDF, DOCX, and TXT (Max 10MB)'}
                  </p>
                  <div className="relative">
                    <input
                      onChange={handleFileUpload}
                      disabled={uploadProgress}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      type="file"
                      accept=".pdf,.docx,.txt"
                    />
                    <button
                      type="button"
                      className="px-xl py-md bg-primary text-white rounded-xl font-label-md text-label-md font-bold hover:brightness-110 active:scale-95 transition-all"
                    >
                      {uploadProgress ? 'Analyzing...' : 'Browse Files'}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {loading && (
              <div className="flex justify-center items-center py-xl">
                <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
              </div>
            )}

            {/* Analysis Results Bento Grid */}
            {analysis && !loading && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl text-left">
                {/* Main Score Card */}
                <div className="col-span-12 lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-lg opacity-10 pointer-events-none">
                    <span className="material-symbols-outlined text-[120px] text-primary">verified</span>
                  </div>
                  <h4 className="font-label-md text-label-md text-on-surface-variant mb-xl self-start font-bold">
                    OVERALL RESUME SCORE
                  </h4>
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle className="text-surface-container-high" cx="80" cy="80" fill="transparent" r="70" stroke="currentColor" strokeWidth="10"></circle>
                      <circle
                        className="text-primary"
                        cx="80"
                        cy="80"
                        fill="transparent"
                        r="70"
                        stroke="currentColor"
                        strokeDasharray="439.8"
                        strokeDashoffset={439.8 - (439.8 * analysis.overallScore) / 100}
                        strokeWidth="10"
                      ></circle>
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-4xl font-black text-on-surface">{analysis.overallScore}</span>
                      <span className="text-[10px] font-bold text-on-surface-variant">OUT OF 100</span>
                    </div>
                  </div>
                  <div className="mt-lg text-center">
                    <p className="font-body-md text-body-md text-on-surface-variant">
                      Your resume is optimized for candidate matching algorithms in your field.
                    </p>
                  </div>
                </div>

                {/* ATS Compatibility */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-sm">
                  <div className="flex justify-between items-center mb-lg">
                    <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider font-bold">
                      ATS COMPATIBILITY
                    </h4>
                    <span className="material-symbols-outlined text-primary">robot_2</span>
                  </div>
                  <div className="space-y-md">
                    <div>
                      <div className="flex justify-between mb-xs">
                        <span className="font-body-sm text-body-sm">Parsing Readiness</span>
                        <span className="font-label-md text-label-md font-bold">{analysis.atsScore}%</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-high rounded-full">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${analysis.atsScore}%` }}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-xs">
                        <span className="font-body-sm text-body-sm">Keyword Matching</span>
                        <span className="font-label-md text-label-md font-bold">{Math.min(analysis.atsScore - 10, 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container-high rounded-full">
                        <div className="h-full bg-secondary rounded-full" style={{ width: `${Math.min(analysis.atsScore - 10, 100)}%` }}></div>
                      </div>
                    </div>
                  </div>
                  <p className="mt-xl font-body-sm text-body-sm text-on-surface-variant italic">
                    Tip: Use standard section titles and avoid double columns to ensure ATS tools parse correctly.
                  </p>
                </div>

                {/* Missing Skills */}
                <div className="col-span-12 md:col-span-6 lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-sm">
                  <h4 className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mb-lg font-bold">
                    MISSING KEY SKILLS
                  </h4>
                  <div className="flex flex-wrap gap-xs">
                    {analysis.missingSkills?.map((skill, index) => (
                      <span
                        key={index}
                        className="px-md py-sm bg-error-container/20 text-error border border-error/20 rounded-full font-label-md text-label-md font-bold"
                      >
                        {skill}
                      </span>
                    )) || <span className="text-body-sm text-on-surface-variant">No missing skills detected.</span>}
                  </div>
                  <div className="mt-xl p-md bg-surface-container-low rounded-xl border border-outline-variant/50">
                    <div className="flex gap-sm">
                      <span className="material-symbols-outlined text-primary">info</span>
                      <p className="font-body-sm text-body-sm">
                        Adding these keywords boosts profile impressions by approximately <span className="font-bold">45%</span>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* AI Strengths & Weaknesses */}
                <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-2xl p-xl shadow-sm">
                  <div className="grid md:grid-cols-2 gap-xl">
                    <div>
                      <div className="flex items-center gap-sm mb-lg">
                        <span className="material-symbols-outlined text-primary">check_circle</span>
                        <h4 className="font-headline-lg text-headline-lg font-bold">Key Strengths</h4>
                      </div>
                      <ul className="space-y-md">
                        {analysis.strengths?.map((strength, index) => (
                          <li key={index} className="flex gap-sm items-start">
                            <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 shrink-0"></span>
                            <p className="font-body-md text-body-md text-on-surface">{strength}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="flex items-center gap-sm mb-lg">
                        <span className="material-symbols-outlined text-secondary">warning</span>
                        <h4 className="font-headline-lg text-headline-lg font-bold">Improvement Areas</h4>
                      </div>
                      <ul className="space-y-md">
                        {analysis.weaknesses?.map((weakness, index) => (
                          <li key={index} className="flex gap-sm items-start">
                            <span className="w-1.5 h-1.5 bg-secondary rounded-full mt-2 shrink-0"></span>
                            <p className="font-body-md text-body-md text-on-surface">{weakness}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                {/* AI Assistant Chat Panel */}
                <div className="col-span-12 lg:col-span-4 flex flex-col h-[480px] bg-primary text-white rounded-2xl p-xl shadow-xl relative">
                  <div className="flex items-center gap-md mb-lg">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-primary shadow-inner">
                      <span className="material-symbols-outlined text-xl">psychology</span>
                    </div>
                    <div>
                      <h4 className="font-label-md text-label-md text-white font-bold">GENIE AI ADVISOR</h4>
                      <span className="text-[10px] bg-white/20 px-xs py-0.5 rounded uppercase font-bold text-white/90">
                        REAL-TIME CHAT
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-md overflow-y-auto pr-xs custom-scrollbar">
                    {chatHistory.map((chat, idx) => (
                      <div
                        key={idx}
                        className={`p-md rounded-xl border border-white/10 ${
                          chat.sender === 'user' ? 'bg-white/20 rounded-tr-none ml-6' : 'bg-white/10 rounded-tl-none mr-6'
                        }`}
                      >
                        <p className="font-body-md text-body-md">{chat.message}</p>
                      </div>
                    ))}
                    {chatSending && (
                      <div className="p-md rounded-xl bg-white/10 rounded-tl-none border border-white/10 mr-6 w-12 flex justify-center">
                        <span className="w-2 h-2 bg-white rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-100 ml-1"></span>
                        <span className="w-2 h-2 bg-white rounded-full animate-bounce delay-200 ml-1"></span>
                      </div>
                    )}
                  </div>

                  <form onSubmit={handleSendChatMessage} className="mt-lg relative">
                    <input
                      required
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      className="w-full bg-white/15 border border-white/20 rounded-xl py-md pl-lg pr-12 text-white placeholder-white/50 focus:ring-white/30 focus:border-white/30 outline-none text-body-sm"
                      placeholder="Ask Genie a question..."
                      type="text"
                    />
                    <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-white">
                      send
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}

        {/* ----------------- TAB 2: RESUME BUILDER ----------------- */}
        {activeTab === 'builder' && (
          <div>
            {/* Sub-view 2.1: Versions List Screen */}
            {!activeVersionId ? (
              <div>
                <div className="flex items-center justify-between mb-lg">
                  <h3 className="font-headline-lg text-2xl font-bold text-on-surface">Resume Versions</h3>
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-sm px-lg py-md bg-primary text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm"
                  >
                    <span className="material-symbols-outlined text-md">add</span>
                    <span>Create New Version</span>
                  </button>
                </div>

                {builderLoading && (
                  <div className="flex justify-center items-center py-xl">
                    <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
                  </div>
                )}

                {!builderLoading && versions.length === 0 ? (
                  <div className="text-center py-2xl border border-outline-variant bg-surface-container-lowest rounded-2xl shadow-sm">
                    <span className="material-symbols-outlined text-5xl text-outline-variant mb-md">post_add</span>
                    <h4 className="font-headline-lg text-lg font-bold mb-xs">No resume versions found</h4>
                    <p className="text-on-surface-variant font-body-sm mb-lg">Get started by creating a tailored resume version.</p>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="px-lg py-md bg-primary text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm"
                    >
                      Create First Version
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg text-left">
                    {versions.map((version) => (
                      <div
                        key={version._id}
                        onClick={() => handleEditVersion(version)}
                        className={`relative group cursor-pointer border border-outline-variant hover:border-primary/50 bg-surface-container-lowest hover:bg-primary/5 rounded-2xl p-xl shadow-sm transition-all duration-300 flex flex-col justify-between`}
                      >
                        {version.isPrimary && (
                          <div className="absolute top-4 right-4 flex items-center gap-xs bg-primary/10 text-primary px-xs py-0.5 rounded-full text-[10px] font-bold">
                            <span className="material-symbols-outlined text-[12px] fill-current">star</span>
                            <span>Primary</span>
                          </div>
                        )}
                        <div>
                          <h4 className="font-headline-lg text-lg font-bold text-on-surface mb-xs pr-16 truncate">{version.title}</h4>
                          <div className="flex flex-wrap gap-xs mb-md">
                            {version.targetRole ? (
                              <span className="px-sm py-0.5 bg-secondary/10 text-secondary border border-secondary/10 rounded-full font-bold text-[10px] tracking-wider uppercase">
                                {version.targetRole}
                              </span>
                            ) : (
                              <span className="px-sm py-0.5 bg-outline-variant/20 text-on-surface-variant rounded-full text-[10px] tracking-wider uppercase">
                                General
                              </span>
                            )}
                            <span className="px-sm py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold tracking-wider uppercase">
                              Template: {version.template}
                            </span>
                          </div>

                          <div className="flex items-center gap-sm mb-xl">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">ATS Score:</span>
                            <span className={`px-sm py-0.5 rounded-full text-xs font-black ${version.lastScore >= 80 ? 'bg-green-100 text-green-700' : version.lastScore >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {version.lastScore || 'Not Scored'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-outline-variant pt-md mt-md">
                          <span className="text-[10px] text-on-surface-variant">
                            Modified {new Date(version.updatedAt).toLocaleDateString()}
                          </span>
                          <div className="flex gap-sm">
                            <button
                              title="Duplicate Resume Version"
                              onClick={(e) => handleDuplicateVersion(e, version._id)}
                              className="w-8 h-8 rounded-lg border border-outline-variant hover:border-primary flex items-center justify-center text-on-surface-variant hover:text-primary transition-all bg-white"
                            >
                              <span className="material-symbols-outlined text-md">content_copy</span>
                            </button>
                            {!version.isPrimary && (
                              <button
                                title="Set Primary"
                                onClick={(e) => handleSetPrimary(e, version._id)}
                                className="w-8 h-8 rounded-lg border border-outline-variant hover:border-primary flex items-center justify-center text-on-surface-variant hover:text-primary transition-all bg-white"
                              >
                                <span className="material-symbols-outlined text-md">star</span>
                              </button>
                            )}
                            <button
                              title="Delete"
                              onClick={(e) => handleDeleteVersion(e, version._id)}
                              className="w-8 h-8 rounded-lg border border-outline-variant hover:border-error flex items-center justify-center text-on-surface-variant hover:text-error transition-all bg-white"
                            >
                              <span className="material-symbols-outlined text-md">delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Sub-view 2.2: Active Editor Canvas */
              activeVersion && (
                <div className="text-left">
                  {/* Top Editor controls bar */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-md mb-xl bg-surface-container-low border border-outline-variant p-md rounded-2xl">
                    <div className="flex items-center gap-md w-full lg:w-auto">
                      <button
                        onClick={() => { setActiveVersionId(null); setActiveVersion(null); loadVersions(); }}
                        className="w-10 h-10 border border-outline-variant rounded-xl flex items-center justify-center hover:bg-surface-container-high transition-all shrink-0"
                      >
                        <span className="material-symbols-outlined">arrow_back</span>
                      </button>
                      <div className="flex-1 lg:flex-none">
                        <input
                          value={activeVersion.title}
                          onChange={(e) => handleFieldChange({ ...activeVersion, title: e.target.value })}
                          className="bg-transparent border-b border-transparent hover:border-outline-variant focus:border-primary text-xl font-black text-on-surface outline-none w-full max-w-sm px-xs py-1"
                          placeholder="Resume Title"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-md w-full lg:w-auto justify-between lg:justify-end">
                      <div className="flex items-center gap-sm">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Template:</span>
                        <div className="flex bg-surface-container p-0.5 rounded-lg border border-outline-variant">
                          {(['modern', 'professional', 'minimal'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => handleFieldChange({ ...activeVersion, template: t })}
                              className={`px-sm py-1 rounded text-xs font-bold capitalize transition-all ${activeVersion.template === t ? 'bg-white text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'}`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-sm">
                        <button
                          onClick={() => handleSetPrimary(null, activeVersion._id)}
                          className="flex items-center gap-xs px-md py-md bg-white border border-outline-variant text-on-surface rounded-xl font-bold hover:bg-surface-container-high transition-all text-xs"
                        >
                          <span className="material-symbols-outlined text-md">star</span>
                          <span>Set Primary</span>
                        </button>
                        <button
                          onClick={handlePrintPdf}
                          className="flex items-center gap-xs px-md py-md bg-white border border-outline-variant text-on-surface rounded-xl font-bold hover:bg-surface-container-high transition-all text-xs"
                        >
                          <span className="material-symbols-outlined text-md">print</span>
                          <span>Print PDF</span>
                        </button>
                        <button
                          onClick={handleDownloadTxt}
                          className="flex items-center gap-xs px-md py-md bg-white border border-outline-variant text-on-surface rounded-xl font-bold hover:bg-surface-container-high transition-all text-xs"
                        >
                          <span className="material-symbols-outlined text-md">download</span>
                          <span>TXT</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 2 Column Grid Editor vs Preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">
                    {/* Left Column: Form Editor */}
                    <div className="lg:col-span-7 space-y-lg">
                      {/* Target Role input */}
                      <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
                        <h4 className="font-headline-lg text-lg font-bold text-on-surface mb-sm flex items-center gap-xs">
                          <span className="material-symbols-outlined text-primary text-md">target</span>
                          <span>Target Career Focus</span>
                        </h4>
                        <div className="flex flex-col gap-xs">
                          <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Job Role / Title</label>
                          <input
                            type="text"
                            value={activeVersion.targetRole || ''}
                            onChange={(e) => handleFieldChange({ ...activeVersion, targetRole: e.target.value })}
                            placeholder="e.g. React Native Developer, Python Data Engineer"
                            className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none focus:border-primary text-body-sm transition-all"
                          />
                        </div>
                      </div>

                      {/* Personal Info */}
                      <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
                        <h4 className="font-headline-lg text-lg font-bold text-on-surface mb-md flex items-center gap-xs">
                          <span className="material-symbols-outlined text-primary text-md">contact_mail</span>
                          <span>Personal Information</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                          <div className="flex flex-col gap-xs">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Full Name</label>
                            <input
                              value={activeVersion.personalInfo.name}
                              onChange={(e) => handleFieldChange({
                                ...activeVersion,
                                personalInfo: { ...activeVersion.personalInfo, name: e.target.value }
                              })}
                              className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Email Address</label>
                            <input
                              value={activeVersion.personalInfo.email}
                              onChange={(e) => handleFieldChange({
                                ...activeVersion,
                                personalInfo: { ...activeVersion.personalInfo, email: e.target.value }
                              })}
                              className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Phone Number</label>
                            <input
                              value={activeVersion.personalInfo.phone}
                              onChange={(e) => handleFieldChange({
                                ...activeVersion,
                                personalInfo: { ...activeVersion.personalInfo, phone: e.target.value }
                              })}
                              className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">LinkedIn URL</label>
                            <input
                              value={activeVersion.personalInfo.linkedin || ''}
                              onChange={(e) => handleFieldChange({
                                ...activeVersion,
                                personalInfo: { ...activeVersion.personalInfo, linkedin: e.target.value }
                              })}
                              className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">GitHub URL</label>
                            <input
                              value={activeVersion.personalInfo.github || ''}
                              onChange={(e) => handleFieldChange({
                                ...activeVersion,
                                personalInfo: { ...activeVersion.personalInfo, github: e.target.value }
                              })}
                              className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                            />
                          </div>
                          <div className="flex flex-col gap-xs">
                            <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Portfolio Website</label>
                            <input
                              value={activeVersion.personalInfo.website || ''}
                              onChange={(e) => handleFieldChange({
                                ...activeVersion,
                                personalInfo: { ...activeVersion.personalInfo, website: e.target.value }
                              })}
                              className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Summary Section */}
                      <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-md">
                          <h4 className="font-headline-lg text-lg font-bold text-on-surface flex items-center gap-xs">
                            <span className="material-symbols-outlined text-primary text-md">description</span>
                            <span>Professional Summary</span>
                          </h4>
                          <div className="flex gap-xs">
                            {summaryRewriting ? (
                              <span className="text-xs text-on-surface-variant animate-pulse flex items-center gap-xs">
                                <span className="w-2 h-2 bg-primary rounded-full animate-ping"></span>
                                Generating Rewrite...
                              </span>
                            ) : (
                              <div className="flex items-center gap-xs bg-surface-container p-0.5 rounded-lg border border-outline-variant">
                                <span className="text-[9px] font-bold px-sm text-on-surface-variant uppercase">AI Rewrite:</span>
                                <button
                                  type="button"
                                  onClick={() => handleRewriteSummary('professional')}
                                  className="px-xs py-0.5 text-[10px] font-bold hover:text-primary transition-all"
                                >
                                  Professional
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRewriteSummary('enthusiastic')}
                                  className="px-xs py-0.5 text-[10px] font-bold hover:text-primary transition-all"
                                >
                                  Enthusiastic
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRewriteSummary('concise')}
                                  className="px-xs py-0.5 text-[10px] font-bold hover:text-primary transition-all"
                                >
                                  Concise
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <textarea
                          rows={4}
                          value={activeVersion.summary}
                          onChange={(e) => handleFieldChange({ ...activeVersion, summary: e.target.value })}
                          className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none focus:border-primary text-body-sm transition-all resize-none"
                          placeholder="Summarize your professional achievements and career goals..."
                        />
                      </div>

                      {/* Professional Experience */}
                      <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-md">
                          <h4 className="font-headline-lg text-lg font-bold text-on-surface flex items-center gap-xs">
                            <span className="material-symbols-outlined text-primary text-md">work</span>
                            <span>Work Experience</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...activeVersion };
                              updated.experience.push({
                                company: '',
                                position: '',
                                location: '',
                                startDate: '',
                                endDate: '',
                                current: false,
                                description: ['']
                              });
                              handleFieldChange(updated);
                            }}
                            className="flex items-center gap-xs text-xs font-bold text-primary hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span>Add Position</span>
                          </button>
                        </div>

                        <div className="space-y-xl">
                          {activeVersion.experience.map((exp, idx) => (
                            <div key={idx} className="border-b border-outline-variant/50 pb-lg last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-center mb-md">
                                <span className="font-bold text-xs bg-surface-container px-sm py-0.5 rounded text-on-surface-variant">
                                  Position #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...activeVersion };
                                    updated.experience.splice(idx, 1);
                                    handleFieldChange(updated);
                                  }}
                                  className="text-error hover:underline text-xs flex items-center gap-xs"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  <span>Remove</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-md">
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company</label>
                                  <input
                                    value={exp.company}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.experience[idx].company = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Job Title / Position</label>
                                  <input
                                    value={exp.position}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.experience[idx].position = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Location</label>
                                  <input
                                    value={exp.location}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.experience[idx].location = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. New York, NY (or Remote)"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Start Date - End Date</label>
                                  <input
                                    value={exp.startDate}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.experience[idx].startDate = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. June 2024 - Present"
                                  />
                                </div>
                              </div>

                              {/* Bullets */}
                              <div className="space-y-sm">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Role Accomplishments & Impact</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = { ...activeVersion };
                                      updated.experience[idx].description.push('');
                                      handleFieldChange(updated);
                                    }}
                                    className="text-xs text-primary hover:underline flex items-center gap-xs"
                                  >
                                    <span className="material-symbols-outlined text-xs">add</span>
                                    <span>Add Bullet</span>
                                  </button>
                                </div>

                                {exp.description.map((bullet, bulletIdx) => {
                                  const key = `experience-${idx}-${bulletIdx}`;
                                  return (
                                    <div key={bulletIdx} className="space-y-xs">
                                      <div className="flex gap-sm items-center">
                                        <input
                                          value={bullet}
                                          onChange={(e) => {
                                            const updated = { ...activeVersion };
                                            updated.experience[idx].description[bulletIdx] = e.target.value;
                                            handleFieldChange(updated);
                                          }}
                                          className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                          placeholder="e.g. Spearheaded engineering of a low-latency API proxy service..."
                                        />
                                        <button
                                          type="button"
                                          title="Improve with AI"
                                          disabled={bulletImproving[key]}
                                          onClick={() => handleImproveBullet(idx, 'experience', bulletIdx)}
                                          className="w-9 h-9 shrink-0 rounded-xl border border-outline-variant hover:border-primary flex items-center justify-center text-on-surface-variant hover:text-primary transition-all bg-white"
                                        >
                                          {bulletImproving[key] ? (
                                            <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                          ) : (
                                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          title="Suggest Action Verbs"
                                          disabled={verbsLoading[key]}
                                          onClick={() => handleSuggestVerbs(idx, 'experience', bulletIdx)}
                                          className="w-9 h-9 shrink-0 rounded-xl border border-outline-variant hover:border-primary flex items-center justify-center text-on-surface-variant hover:text-primary transition-all bg-white font-bold text-xs"
                                        >
                                          V
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = { ...activeVersion };
                                            updated.experience[idx].description.splice(bulletIdx, 1);
                                            handleFieldChange(updated);
                                          }}
                                          className="text-on-surface-variant hover:text-error shrink-0"
                                        >
                                          <span className="material-symbols-outlined text-md">close</span>
                                        </button>
                                      </div>

                                      {/* Suggested verbs drop */}
                                      {suggestedVerbs[key] && (
                                        <div className="p-sm bg-primary/5 rounded-xl border border-primary/20 text-xs flex flex-wrap items-center gap-xs">
                                          <span className="font-bold text-[9px] text-primary uppercase">Strong Action Verbs:</span>
                                          {suggestedVerbs[key].map((verb, vIdx) => (
                                            <span
                                              key={vIdx}
                                              onClick={() => {
                                                const updated = { ...activeVersion };
                                                const currentBullet = updated.experience[idx].description[bulletIdx];
                                                // Replace first word with verb or prepend
                                                const words = currentBullet.split(' ');
                                                words[0] = verb;
                                                updated.experience[idx].description[bulletIdx] = words.join(' ');
                                                handleFieldChange(updated);
                                                // Clear suggested verbs list
                                                setSuggestedVerbs(prev => {
                                                  const copy = { ...prev };
                                                  delete copy[key];
                                                  return copy;
                                                });
                                              }}
                                              className="px-sm py-0.5 bg-white border border-primary/25 rounded hover:bg-primary/10 cursor-pointer text-primary font-bold"
                                            >
                                              {verb}
                                            </span >
                                          ))}
                                          <span
                                            onClick={() => setSuggestedVerbs(prev => {
                                              const copy = { ...prev };
                                              delete copy[key];
                                              return copy;
                                            })}
                                            className="text-[9px] hover:underline cursor-pointer text-on-surface-variant font-bold ml-auto"
                                          >
                                            Dismiss
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Education Section */}
                      <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-md">
                          <h4 className="font-headline-lg text-lg font-bold text-on-surface flex items-center gap-xs">
                            <span className="material-symbols-outlined text-primary text-md">school</span>
                            <span>Education</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...activeVersion };
                              updated.education.push({
                                institution: '',
                                degree: '',
                                fieldOfStudy: '',
                                startDate: '',
                                endDate: '',
                                gpa: ''
                              });
                              handleFieldChange(updated);
                            }}
                            className="flex items-center gap-xs text-xs font-bold text-primary hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span>Add Education</span>
                          </button>
                        </div>

                        <div className="space-y-xl">
                          {activeVersion.education.map((edu, idx) => (
                            <div key={idx} className="border-b border-outline-variant/50 pb-lg last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-center mb-md">
                                <span className="font-bold text-xs bg-surface-container px-sm py-0.5 rounded text-on-surface-variant">
                                  Education #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...activeVersion };
                                    updated.education.splice(idx, 1);
                                    handleFieldChange(updated);
                                  }}
                                  className="text-error hover:underline text-xs flex items-center gap-xs"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  <span>Remove</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Institution / School</label>
                                  <input
                                    value={edu.institution}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.education[idx].institution = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Degree</label>
                                  <input
                                    value={edu.degree}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.education[idx].degree = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. Bachelor of Science"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Field of Study</label>
                                  <input
                                    value={edu.fieldOfStudy}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.education[idx].fieldOfStudy = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. Computer Science"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Dates attended</label>
                                  <input
                                    value={edu.startDate}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.education[idx].startDate = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. Sept 2021 - May 2025"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">GPA (Optional)</label>
                                  <input
                                    value={edu.gpa || ''}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.education[idx].gpa = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. 3.8 / 4.0"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Projects Section */}
                      <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm">
                        <div className="flex items-center justify-between mb-md">
                          <h4 className="font-headline-lg text-lg font-bold text-on-surface flex items-center gap-xs">
                            <span className="material-symbols-outlined text-primary text-md">code</span>
                            <span>Key Projects</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...activeVersion };
                              updated.projects.push({
                                title: '',
                                role: '',
                                technologies: [],
                                link: '',
                                description: ['']
                              });
                              handleFieldChange(updated);
                            }}
                            className="flex items-center gap-xs text-xs font-bold text-primary hover:underline"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span>Add Project</span>
                          </button>
                        </div>

                        <div className="space-y-xl">
                          {activeVersion.projects.map((proj, idx) => (
                            <div key={idx} className="border-b border-outline-variant/50 pb-lg last:border-b-0 last:pb-0">
                              <div className="flex justify-between items-center mb-md">
                                <span className="font-bold text-xs bg-surface-container px-sm py-0.5 rounded text-on-surface-variant">
                                  Project #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = { ...activeVersion };
                                    updated.projects.splice(idx, 1);
                                    handleFieldChange(updated);
                                  }}
                                  className="text-error hover:underline text-xs flex items-center gap-xs"
                                >
                                  <span className="material-symbols-outlined text-sm">delete</span>
                                  <span>Remove</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-md mb-md">
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Project Title</label>
                                  <input
                                    value={proj.title}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.projects[idx].title = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Your Role</label>
                                  <input
                                    value={proj.role}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.projects[idx].role = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. Lead Frontend Developer"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Technologies (Comma separated)</label>
                                  <input
                                    value={proj.technologies.join(', ')}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.projects[idx].technologies = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. React, Next.js, WebRTC"
                                  />
                                </div>
                                <div className="flex flex-col gap-xs">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Demo / GitHub Link</label>
                                  <input
                                    value={proj.link || ''}
                                    onChange={(e) => {
                                      const updated = { ...activeVersion };
                                      updated.projects[idx].link = e.target.value;
                                      handleFieldChange(updated);
                                    }}
                                    className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                    placeholder="e.g. https://github.com/myusername/project"
                                  />
                                </div>
                              </div>

                              {/* Bullets */}
                              <div className="space-y-sm">
                                <div className="flex justify-between items-center">
                                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Key Details & Contributions</label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = { ...activeVersion };
                                      updated.projects[idx].description.push('');
                                      handleFieldChange(updated);
                                    }}
                                    className="text-xs text-primary hover:underline flex items-center gap-xs"
                                  >
                                    <span className="material-symbols-outlined text-xs">add</span>
                                    <span>Add Bullet</span>
                                  </button>
                                </div>

                                {proj.description.map((bullet, bulletIdx) => {
                                  const key = `projects-${idx}-${bulletIdx}`;
                                  return (
                                    <div key={bulletIdx} className="space-y-xs">
                                      <div className="flex gap-sm items-center">
                                        <input
                                          value={bullet}
                                          onChange={(e) => {
                                            const updated = { ...activeVersion };
                                            updated.projects[idx].description[bulletIdx] = e.target.value;
                                            handleFieldChange(updated);
                                          }}
                                          className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary transition-all"
                                          placeholder="e.g. Engineered real-time chat sync with socket.io..."
                                        />
                                        <button
                                          type="button"
                                          title="Improve with AI"
                                          disabled={bulletImproving[key]}
                                          onClick={() => handleImproveBullet(idx, 'projects', bulletIdx)}
                                          className="w-9 h-9 shrink-0 rounded-xl border border-outline-variant hover:border-primary flex items-center justify-center text-on-surface-variant hover:text-primary transition-all bg-white"
                                        >
                                          {bulletImproving[key] ? (
                                            <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                          ) : (
                                            <span className="material-symbols-outlined text-sm">auto_awesome</span>
                                          )}
                                        </button>
                                        <button
                                          type="button"
                                          title="Suggest Action Verbs"
                                          disabled={verbsLoading[key]}
                                          onClick={() => handleSuggestVerbs(idx, 'projects', bulletIdx)}
                                          className="w-9 h-9 shrink-0 rounded-xl border border-outline-variant hover:border-primary flex items-center justify-center text-on-surface-variant hover:text-primary transition-all bg-white font-bold text-xs"
                                        >
                                          V
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = { ...activeVersion };
                                            updated.projects[idx].description.splice(bulletIdx, 1);
                                            handleFieldChange(updated);
                                          }}
                                          className="text-on-surface-variant hover:text-error shrink-0"
                                        >
                                          <span className="material-symbols-outlined text-md">close</span>
                                        </button>
                                      </div>

                                      {/* Suggested verbs drop */}
                                      {suggestedVerbs[key] && (
                                        <div className="p-sm bg-primary/5 rounded-xl border border-primary/20 text-xs flex flex-wrap items-center gap-xs">
                                          <span className="font-bold text-[9px] text-primary uppercase">Strong Action Verbs:</span>
                                          {suggestedVerbs[key].map((verb, vIdx) => (
                                            <span
                                              key={vIdx}
                                              onClick={() => {
                                                const updated = { ...activeVersion };
                                                const currentBullet = updated.projects[idx].description[bulletIdx];
                                                const words = currentBullet.split(' ');
                                                words[0] = verb;
                                                updated.projects[idx].description[bulletIdx] = words.join(' ');
                                                handleFieldChange(updated);
                                                setSuggestedVerbs(prev => {
                                                  const copy = { ...prev };
                                                  delete copy[key];
                                                  return copy;
                                                });
                                              }}
                                              className="px-sm py-0.5 bg-white border border-primary/25 rounded hover:bg-primary/10 cursor-pointer text-primary font-bold"
                                            >
                                              {verb}
                                            </span>
                                          ))}
                                          <span
                                            onClick={() => setSuggestedVerbs(prev => {
                                              const copy = { ...prev };
                                              delete copy[key];
                                              return copy;
                                            })}
                                            className="text-[9px] hover:underline cursor-pointer text-on-surface-variant font-bold ml-auto"
                                          >
                                            Dismiss
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Skills & Certifications */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                        <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm text-left">
                          <h4 className="font-headline-lg text-lg font-bold text-on-surface mb-md flex items-center gap-xs">
                            <span className="material-symbols-outlined text-primary text-md">star</span>
                            <span>Key Technical Skills</span>
                          </h4>
                          <textarea
                            rows={3}
                            value={activeVersion.skills.join(', ')}
                            onChange={(e) => {
                              const updated = {
                                ...activeVersion,
                                skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              };
                              handleFieldChange(updated);
                            }}
                            className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none focus:border-primary text-body-sm transition-all resize-none"
                            placeholder="Comma-separated: React, Node.js, TypeScript, Docker..."
                          />
                        </div>

                        <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm text-left">
                          <h4 className="font-headline-lg text-lg font-bold text-on-surface mb-md flex items-center gap-xs">
                            <span className="material-symbols-outlined text-primary text-md">workspace_premium</span>
                            <span>Certifications</span>
                          </h4>
                          <textarea
                            rows={3}
                            value={activeVersion.certifications.join(', ')}
                            onChange={(e) => {
                              const updated = {
                                ...activeVersion,
                                certifications: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                              };
                              handleFieldChange(updated);
                            }}
                            className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none focus:border-primary text-body-sm transition-all resize-none"
                            placeholder="Comma-separated: AWS Certified Cloud Practitioner, Scrum Master..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Sticky Score Preview & A4 Live Render */}
                    <div className="lg:col-span-5 space-y-lg lg:sticky lg:top-24">
                      {/* Score Widget */}
                      <div className="p-xl bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-sm flex flex-col items-center">
                        <div className="flex items-center justify-between w-full mb-md">
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Live Heuristic Score</span>
                          <button
                            type="button"
                            disabled={recalculatingAI || cooldownRemaining !== null}
                            onClick={handleRecalculateAI}
                            className="flex items-center gap-xs px-sm py-1 bg-primary/10 text-primary rounded-lg font-bold text-xs hover:bg-primary/20 transition-all disabled:opacity-50"
                          >
                            {recalculatingAI ? (
                              <>
                                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"></span>
                                <span>Evaluating...</span>
                              </>
                            ) : cooldownRemaining !== null ? (
                              <span>Recalculate ({cooldownRemaining}s)</span>
                            ) : (
                              <>
                                <span className="material-symbols-outlined text-xs">refresh</span>
                                <span>Recalculate with AI</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Score representation */}
                        <div className="flex items-center justify-between w-full mb-lg p-md bg-surface-container-low border border-outline-variant/60 rounded-xl">
                          <div className="flex items-center gap-md">
                            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                              <svg className="w-full h-full transform -rotate-90">
                                <circle className="text-surface-container-high" cx="32" cy="32" fill="transparent" r="28" stroke="currentColor" strokeWidth="4"></circle>
                                <circle
                                  className={`${liveDetails.score >= 80 ? 'text-green-500' : liveDetails.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}
                                  cx="32"
                                  cy="32"
                                  fill="transparent"
                                  r="28"
                                  stroke="currentColor"
                                  strokeDasharray="175.9"
                                  strokeDashoffset={175.9 - (175.9 * liveDetails.score) / 100}
                                  strokeWidth="4"
                                ></circle>
                              </svg>
                              <span className="absolute text-lg font-black text-on-surface">{liveDetails.score}%</span>
                            </div>
                            <div>
                              <h5 className="font-bold text-body-md">Resume Score Preview</h5>
                              <p className="text-[10px] text-on-surface-variant">Update fields to instantly update prediction.</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Last AI Score</span>
                            <span className="text-xl font-black text-primary">{activeVersion.lastScore || 'N/A'}</span>
                          </div>
                        </div>

                        {/* Strengths & Missing accordion/list */}
                        <div className="w-full text-left space-y-md">
                          <div>
                            <h6 className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-xs flex items-center gap-xs">
                              <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                              <span>Strengths ({liveDetails.strengths.length})</span>
                            </h6>
                            <ul className="space-y-1 text-body-xs pl-md border-l-2 border-green-500 text-on-surface-variant">
                              {liveDetails.strengths.slice(0, 3).map((st, idx) => <li key={idx}>• {st}</li>)}
                            </ul>
                          </div>
                          {liveDetails.missing.length > 0 && (
                            <div>
                              <h6 className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-xs flex items-center gap-xs">
                                <span className="material-symbols-outlined text-sm font-bold">cancel</span>
                                <span>Improvement Gaps ({liveDetails.missing.length})</span>
                              </h6>
                              <ul className="space-y-1 text-body-xs pl-md border-l-2 border-red-500 text-on-surface-variant">
                                {liveDetails.missing.slice(0, 3).map((ms, idx) => <li key={idx}>• {ms}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* ATS Score Progress History */}
                        {activeVersion.analysisHistory && activeVersion.analysisHistory.length > 0 && (
                          <div className="w-full text-left border-t border-outline-variant pt-md mt-md">
                            <h6 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-sm">Score Progression History</h6>
                            <div className="space-y-sm max-h-32 overflow-y-auto custom-scrollbar pr-xs">
                              {activeVersion.analysisHistory.slice().reverse().map((hist, hIdx) => (
                                <div key={hIdx} className="flex justify-between items-center text-xs bg-surface-container p-xs rounded border border-outline-variant/40">
                                  <span className="font-bold text-primary">{hist.score}% Score</span>
                                  <span className="text-[10px] text-on-surface-variant">{new Date(hist.analyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(hist.analyzedAt).toLocaleDateString()})</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Live template canvas render */}
                      <div className="border border-outline-variant rounded-2xl bg-white shadow-lg p-lg overflow-x-auto text-left leading-relaxed">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-md">Live Template Preview</span>
                        
                        {/* Modern Layout */}
                        {activeVersion.template === 'modern' && (
                          <div className="border-l-4 border-primary pl-md py-sm">
                            <h2 className="text-2xl font-black text-primary tracking-wide uppercase">{activeVersion.personalInfo.name || 'Your Name'}</h2>
                            <p className="text-xs text-on-surface-variant mb-md">
                              {activeVersion.personalInfo.email} {activeVersion.personalInfo.phone && `| ${activeVersion.personalInfo.phone}`}
                              {activeVersion.personalInfo.linkedin && ` | LinkedIn: ${activeVersion.personalInfo.linkedin}`}
                              {activeVersion.personalInfo.github && ` | GitHub: ${activeVersion.personalInfo.github}`}
                            </p>
                            
                            {activeVersion.summary && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-xs mb-xs">Summary</h3>
                                <p className="text-xs text-on-surface">{activeVersion.summary}</p>
                              </div>
                            )}

                            {activeVersion.experience.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-xs mb-xs">Experience</h3>
                                {activeVersion.experience.map((exp, idx) => (
                                  <div key={idx} className="mb-sm">
                                    <div className="flex justify-between text-xs font-bold">
                                      <span>{exp.position} at {exp.company}</span>
                                      <span className="text-on-surface-variant font-normal">{exp.startDate}</span>
                                    </div>
                                    <ul className="list-disc pl-md text-xs text-on-surface mt-xs space-y-0.5">
                                      {exp.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}

                            {activeVersion.projects.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-xs mb-xs">Projects</h3>
                                {activeVersion.projects.map((proj, idx) => (
                                  <div key={idx} className="mb-sm">
                                    <div className="flex justify-between text-xs font-bold">
                                      <span>{proj.title} ({proj.role})</span>
                                      <span className="text-on-surface-variant font-normal text-[10px]">{proj.technologies.join(', ')}</span>
                                    </div>
                                    <ul className="list-disc pl-md text-xs text-on-surface mt-xs space-y-0.5">
                                      {proj.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}

                            {activeVersion.skills.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-xs mb-xs">Skills</h3>
                                <p className="text-xs text-on-surface">{activeVersion.skills.join(', ')}</p>
                              </div>
                            )}

                            {activeVersion.education.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-outline-variant pb-xs mb-xs">Education</h3>
                                {activeVersion.education.map((edu, idx) => (
                                  <div key={idx} className="text-xs mb-xs">
                                    <div className="flex justify-between font-bold">
                                      <span>{edu.degree} in {edu.fieldOfStudy}</span>
                                      <span className="text-on-surface-variant font-normal">{edu.startDate}</span>
                                    </div>
                                    <p className="text-[10px] text-on-surface-variant">{edu.institution} {edu.gpa && `| GPA: ${edu.gpa}`}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Professional Layout */}
                        {activeVersion.template === 'professional' && (
                          <div className="font-serif">
                            <div className="text-center mb-md border-b-2 border-on-surface pb-sm">
                              <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase">{activeVersion.personalInfo.name || 'Your Name'}</h2>
                              <p className="text-[11px] text-on-surface-variant">
                                {activeVersion.personalInfo.email} {activeVersion.personalInfo.phone && `• ${activeVersion.personalInfo.phone}`}
                                {activeVersion.personalInfo.linkedin && ` • LinkedIn: ${activeVersion.personalInfo.linkedin}`}
                                {activeVersion.personalInfo.github && ` • GitHub: ${activeVersion.personalInfo.github}`}
                              </p>
                            </div>
                            
                            {activeVersion.summary && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide border-b border-on-surface pb-xs mb-xs">Professional Summary</h3>
                                <p className="text-xs text-on-surface">{activeVersion.summary}</p>
                              </div>
                            )}

                            {activeVersion.experience.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide border-b border-on-surface pb-xs mb-xs">Professional Experience</h3>
                                {activeVersion.experience.map((exp, idx) => (
                                  <div key={idx} className="mb-sm text-xs">
                                    <div className="flex justify-between font-bold">
                                      <span>{exp.position} | {exp.company}</span>
                                      <span>{exp.startDate}</span>
                                    </div>
                                    <ul className="list-disc pl-md mt-xs space-y-0.5">
                                      {exp.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}

                            {activeVersion.projects.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide border-b border-on-surface pb-xs mb-xs">Projects</h3>
                                {activeVersion.projects.map((proj, idx) => (
                                  <div key={idx} className="mb-sm text-xs">
                                    <div className="flex justify-between font-bold">
                                      <span>{proj.title} ({proj.role})</span>
                                      <span>{proj.technologies.join(', ')}</span>
                                    </div>
                                    <ul className="list-disc pl-md mt-xs space-y-0.5">
                                      {proj.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}

                            {activeVersion.skills.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide border-b border-on-surface pb-xs mb-xs">Technical Skills</h3>
                                <p className="text-xs text-on-surface">{activeVersion.skills.join(', ')}</p>
                              </div>
                            )}

                            {activeVersion.education.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide border-b border-on-surface pb-xs mb-xs">Education</h3>
                                {activeVersion.education.map((edu, idx) => (
                                  <div key={idx} className="text-xs mb-xs">
                                    <div className="flex justify-between font-bold">
                                      <span>{edu.institution} — {edu.degree}</span>
                                      <span>{edu.startDate}</span>
                                    </div>
                                    <p className="text-[10px] text-on-surface-variant">{edu.fieldOfStudy} {edu.gpa && `(GPA: ${edu.gpa})`}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Minimal Layout */}
                        {activeVersion.template === 'minimal' && (
                          <div className="font-sans text-on-surface">
                            <div className="mb-md">
                              <h2 className="text-2xl font-bold tracking-tight">{activeVersion.personalInfo.name || 'Your Name'}</h2>
                              <p className="text-[10px] text-on-surface-variant flex gap-sm">
                                <span>{activeVersion.personalInfo.email}</span>
                                <span>{activeVersion.personalInfo.phone}</span>
                                {activeVersion.personalInfo.linkedin && <span>LinkedIn: {activeVersion.personalInfo.linkedin}</span>}
                              </p>
                            </div>
                            
                            {activeVersion.summary && (
                              <div className="mb-md">
                                <p className="text-xs text-on-surface italic">{activeVersion.summary}</p>
                              </div>
                            )}

                            {activeVersion.experience.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-xs">Work</h3>
                                {activeVersion.experience.map((exp, idx) => (
                                  <div key={idx} className="mb-sm text-xs">
                                    <div className="flex justify-between font-semibold">
                                      <span>{exp.position} @ {exp.company}</span>
                                      <span className="font-normal text-on-surface-variant">{exp.startDate}</span>
                                    </div>
                                    <ul className="list-disc pl-md mt-xs space-y-0.5 text-on-surface-variant">
                                      {exp.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}

                            {activeVersion.projects.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-xs">Projects</h3>
                                {activeVersion.projects.map((proj, idx) => (
                                  <div key={idx} className="mb-sm text-xs">
                                    <div className="flex justify-between font-semibold">
                                      <span>{proj.title} ({proj.role})</span>
                                      <span className="font-normal text-on-surface-variant">{proj.technologies.join(', ')}</span>
                                    </div>
                                    <ul className="list-disc pl-md mt-xs space-y-0.5 text-on-surface-variant">
                                      {proj.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            )}

                            {activeVersion.skills.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-xs">Skills</h3>
                                <p className="text-xs text-on-surface-variant">{activeVersion.skills.join(', ')}</p>
                              </div>
                            )}

                            {activeVersion.education.length > 0 && (
                              <div className="mb-md">
                                <h3 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-xs">Education</h3>
                                {activeVersion.education.map((edu, idx) => (
                                  <div key={idx} className="text-xs mb-xs">
                                    <div className="flex justify-between font-semibold">
                                      <span>{edu.institution}</span>
                                      <span className="font-normal text-on-surface-variant">{edu.startDate}</span>
                                    </div>
                                    <p className="text-[10px] text-on-surface-variant">{edu.degree} in {edu.fieldOfStudy}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Modal for creating a new Resume Version */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-md">
          <div className="bg-surface-container-lowest border border-outline-variant p-xl rounded-2xl max-w-md w-full shadow-2xl text-left">
            <h3 className="font-headline-lg text-xl font-bold mb-md">Create Resume Version</h3>
            <form onSubmit={handleCreateVersion} className="space-y-md">
              <div className="flex flex-col gap-xs">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Version Name / Title</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Senior Frontend Resume"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary w-full"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Target Role Focus (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. React Engineer"
                  value={newTargetRole}
                  onChange={(e) => setNewTargetRole(e.target.value)}
                  className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary w-full"
                />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Select Style Template</label>
                <select
                  value={newTemplate}
                  onChange={(e) => setNewTemplate(e.target.value as any)}
                  className="bg-surface-container-low border border-outline-variant rounded-xl p-md outline-none text-body-sm focus:border-primary w-full capitalize"
                >
                  <option value="modern">Modern</option>
                  <option value="professional">Professional</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>

              <div className="flex justify-end gap-md pt-md border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-lg py-md border border-outline-variant rounded-xl font-bold hover:bg-surface-container-high transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-lg py-md bg-primary text-white rounded-xl font-bold hover:brightness-110 active:scale-95 transition-all shadow-sm text-sm"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Dynamic PRINT layout for high-quality resume downloads        */}
      {/* ------------------------------------------------------------- */}
      {activeVersion && (
        <div className="hidden print:block text-left p-xl bg-white text-black leading-relaxed font-sans max-w-4xl mx-auto">
          {activeVersion.template === 'modern' && (
            <div className="border-l-4 border-black pl-md py-sm">
              <h2 className="text-3xl font-black text-black tracking-wide uppercase">{activeVersion.personalInfo.name || 'Your Name'}</h2>
              <p className="text-xs text-gray-600 mb-md">
                {activeVersion.personalInfo.email} {activeVersion.personalInfo.phone && `| ${activeVersion.personalInfo.phone}`}
                {activeVersion.personalInfo.linkedin && ` | LinkedIn: ${activeVersion.personalInfo.linkedin}`}
                {activeVersion.personalInfo.github && ` | GitHub: ${activeVersion.personalInfo.github}`}
              </p>
              
              {activeVersion.summary && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wider border-b border-black pb-xs mb-xs">Summary</h3>
                  <p className="text-xs text-black">{activeVersion.summary}</p>
                </div>
              )}

              {activeVersion.experience.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wider border-b border-black pb-xs mb-xs">Experience</h3>
                  {activeVersion.experience.map((exp, idx) => (
                    <div key={idx} className="mb-sm">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{exp.position} at {exp.company}</span>
                        <span className="text-gray-600 font-normal">{exp.startDate}</span>
                      </div>
                      <ul className="list-disc pl-md text-xs text-black mt-xs space-y-0.5">
                        {exp.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeVersion.projects.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wider border-b border-black pb-xs mb-xs">Projects</h3>
                  {activeVersion.projects.map((proj, idx) => (
                    <div key={idx} className="mb-sm">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{proj.title} ({proj.role})</span>
                        <span className="text-gray-600 font-normal text-[10px]">{proj.technologies.join(', ')}</span>
                      </div>
                      <ul className="list-disc pl-md text-xs text-black mt-xs space-y-0.5">
                        {proj.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeVersion.skills.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wider border-b border-black pb-xs mb-xs">Skills</h3>
                  <p className="text-xs text-black">{activeVersion.skills.join(', ')}</p>
                </div>
              )}

              {activeVersion.education.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wider border-b border-black pb-xs mb-xs">Education</h3>
                  {activeVersion.education.map((edu, idx) => (
                    <div key={idx} className="text-xs mb-xs">
                      <div className="flex justify-between font-bold">
                        <span>{edu.degree} in {edu.fieldOfStudy}</span>
                        <span className="text-gray-600 font-normal">{edu.startDate}</span>
                      </div>
                      <p className="text-[10px] text-gray-500">{edu.institution} {edu.gpa && `| GPA: ${edu.gpa}`}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeVersion.template === 'professional' && (
            <div className="font-serif">
              <div className="text-center mb-md border-b-2 border-black pb-sm">
                <h2 className="text-3xl font-bold tracking-tight text-black uppercase">{activeVersion.personalInfo.name || 'Your Name'}</h2>
                <p className="text-[11px] text-gray-600">
                  {activeVersion.personalInfo.email} {activeVersion.personalInfo.phone && `• ${activeVersion.personalInfo.phone}`}
                  {activeVersion.personalInfo.linkedin && ` • LinkedIn: ${activeVersion.personalInfo.linkedin}`}
                  {activeVersion.personalInfo.github && ` • GitHub: ${activeVersion.personalInfo.github}`}
                </p>
              </div>
              
              {activeVersion.summary && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wide border-b border-black pb-xs mb-xs">Professional Summary</h3>
                  <p className="text-xs text-black">{activeVersion.summary}</p>
                </div>
              )}

              {activeVersion.experience.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wide border-b border-black pb-xs mb-xs">Professional Experience</h3>
                  {activeVersion.experience.map((exp, idx) => (
                    <div key={idx} className="mb-sm text-xs">
                      <div className="flex justify-between font-bold">
                        <span>{exp.position} | {exp.company}</span>
                        <span>{exp.startDate}</span>
                      </div>
                      <ul className="list-disc pl-md mt-xs space-y-0.5">
                        {exp.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeVersion.projects.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wide border-b border-black pb-xs mb-xs">Projects</h3>
                  {activeVersion.projects.map((proj, idx) => (
                    <div key={idx} className="mb-sm text-xs">
                      <div className="flex justify-between font-bold">
                        <span>{proj.title} ({proj.role})</span>
                        <span>{proj.technologies.join(', ')}</span>
                      </div>
                      <ul className="list-disc pl-md mt-xs space-y-0.5">
                        {proj.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeVersion.skills.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wide border-b border-black pb-xs mb-xs">Technical Skills</h3>
                  <p className="text-xs text-black">{activeVersion.skills.join(', ')}</p>
                </div>
              )}

              {activeVersion.education.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-xs font-bold text-black uppercase tracking-wide border-b border-black pb-xs mb-xs">Education</h3>
                  {activeVersion.education.map((edu, idx) => (
                    <div key={idx} className="text-xs mb-xs">
                      <div className="flex justify-between font-bold">
                        <span>{edu.institution} — {edu.degree}</span>
                        <span>{edu.startDate}</span>
                      </div>
                      <p className="text-[10px] text-gray-600">{edu.fieldOfStudy} {edu.gpa && `(GPA: ${edu.gpa})`}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeVersion.template === 'minimal' && (
            <div className="font-sans text-black">
              <div className="mb-md">
                <h2 className="text-3xl font-bold tracking-tight">{activeVersion.personalInfo.name || 'Your Name'}</h2>
                <p className="text-[10px] text-gray-600 flex gap-sm">
                  <span>{activeVersion.personalInfo.email}</span>
                  <span>{activeVersion.personalInfo.phone}</span>
                  {activeVersion.personalInfo.linkedin && <span>LinkedIn: {activeVersion.personalInfo.linkedin}</span>}
                </p>
              </div>
              
              {activeVersion.summary && (
                <div className="mb-md">
                  <p className="text-xs text-black italic">{activeVersion.summary}</p>
                </div>
              )}

              {activeVersion.experience.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-xs">Work</h3>
                  {activeVersion.experience.map((exp, idx) => (
                    <div key={idx} className="mb-sm text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>{exp.position} @ {exp.company}</span>
                        <span className="font-normal text-gray-600">{exp.startDate}</span>
                      </div>
                      <ul className="list-disc pl-md mt-xs space-y-0.5 text-gray-600 font-normal">
                        {exp.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeVersion.projects.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-xs">Projects</h3>
                  {activeVersion.projects.map((proj, idx) => (
                    <div key={idx} className="mb-sm text-xs">
                      <div className="flex justify-between font-semibold">
                        <span>{proj.title} ({proj.role})</span>
                        <span className="font-normal text-gray-600">{proj.technologies.join(', ')}</span>
                      </div>
                      <ul className="list-disc pl-md mt-xs space-y-0.5 text-gray-600 font-normal">
                        {proj.description.map((bul, bIdx) => <li key={bIdx}>{bul}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {activeVersion.skills.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-xs">Skills</h3>
                  <p className="text-xs text-gray-600">{activeVersion.skills.join(', ')}</p>
                </div>
              )}

              {activeVersion.education.length > 0 && (
                <div className="mb-md">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-xs">Education</h3>
                  {activeVersion.education.map((edu, idx) => (
                    <div key={idx} className="text-xs mb-xs">
                      <div className="flex justify-between font-semibold">
                        <span>{edu.institution}</span>
                        <span className="font-normal text-gray-600">{edu.startDate}</span>
                      </div>
                      <p className="text-[10px] text-gray-600">{edu.degree} in {edu.fieldOfStudy}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
