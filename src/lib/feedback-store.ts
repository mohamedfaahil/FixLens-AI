import { useState, useEffect, useCallback } from "react";
import { BUILDINGS } from "./demo-data";

export type FeedbackCategory =
  | "Facility Maintenance & Cleanliness"
  | "Complaint Resolution Speed"
  | "Restrooms & Water Services"
  | "Lab & Classroom Amenities"
  | "FixLens AI Platform & Experience"
  | "Campus Living & Environment";

export const FEEDBACK_CATEGORIES: FeedbackCategory[] = [
  "Facility Maintenance & Cleanliness",
  "Complaint Resolution Speed",
  "Restrooms & Water Services",
  "Lab & Classroom Amenities",
  "FixLens AI Platform & Experience",
  "Campus Living & Environment",
];

export interface StudentFeedback {
  id: string;
  title: string;
  content: string;
  category: FeedbackCategory;
  rating: number; // 1 to 5
  building: string;
  authorName: string;
  authorDepartment: string;
  isAnonymous: boolean;
  createdAt: string;
  helpfulVotes: number;
  adminStatus: "Under Review" | "Acknowledged" | "Action Taken";
  adminResponse?: string;
}

const INITIAL_FEEDBACKS: StudentFeedback[] = [
  {
    id: "FB-101",
    title: "Fast repair of Seminar Hall Projector in CS Block",
    content: "The technician arrived within 3 hours after filing the complaint on FixLens AI. The new bulb is bright and class presentations are back to normal.",
    category: "Complaint Resolution Speed",
    rating: 5,
    building: "CS Block",
    authorName: "Mohamed Anwar",
    authorDepartment: "Computer Applications (MCA)",
    isAnonymous: false,
    createdAt: "2026-11-24",
    helpfulVotes: 14,
    adminStatus: "Action Taken",
    adminResponse: "Maintenance team verified and resolved within the priority SLA window.",
  },
  {
    id: "FB-102",
    title: "Need additional water dispensers in Mechanical Science Block",
    content: "The 2nd floor water cooler often runs low during peak lunch hours. Requesting an extra purified water station or larger capacity tank.",
    category: "Restrooms & Water Services",
    rating: 4,
    building: "Mechanical Science (MS) Block",
    authorName: "Amina Khan",
    authorDepartment: "Mechanical",
    isAnonymous: false,
    createdAt: "2026-11-22",
    helpfulVotes: 9,
    adminStatus: "Acknowledged",
    adminResponse: "Facilities management has scheduled a pipeline capacity audit for MS Block.",
  },
  {
    id: "FB-103",
    title: "FixLens AI direct camera capture makes reporting much easier",
    content: "The new direct camera capture and instant photo preview feature saves a lot of time when snapping defective furniture or broken sockets directly on phone.",
    category: "FixLens AI Platform & Experience",
    rating: 5,
    building: "SM Block",
    authorName: "Verified Student",
    authorDepartment: "Electronics",
    isAnonymous: true,
    createdAt: "2026-11-20",
    helpfulVotes: 19,
    adminStatus: "Acknowledged",
    adminResponse: "Thank you for the positive feedback on the new camera release!",
  },
  {
    id: "FB-104",
    title: "Main Library Study Cubicle lighting improvement",
    content: "Lighting in the 3rd floor quiet study area is calm and conducive for long research sessions. Air conditioning was also well balanced.",
    category: "Lab & Classroom Amenities",
    rating: 5,
    building: "Main Library",
    authorName: "Karthik R.",
    authorDepartment: "Computer Science",
    isAnonymous: false,
    createdAt: "2026-11-18",
    helpfulVotes: 8,
    adminStatus: "Action Taken",
  },
  {
    id: "FB-105",
    title: "Main Canteen seating hygiene during peak lunch rush",
    content: "Tables near the south entrance could use more frequent wiping between 12:30 PM and 1:30 PM. Otherwise the meal services are great.",
    category: "Facility Maintenance & Cleanliness",
    rating: 4,
    building: "Main Canteen",
    authorName: "Sana Parveen",
    authorDepartment: "Management (MBA)",
    isAnonymous: false,
    createdAt: "2026-11-15",
    helpfulVotes: 11,
    adminStatus: "Under Review",
  },
];

const STORAGE_KEY = "fixlens_student_feedbacks";
const VOTED_KEY = "fixlens_student_feedback_votes";

function loadStoredFeedback(): StudentFeedback[] {
  if (typeof window === "undefined") return INITIAL_FEEDBACKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_FEEDBACKS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_FEEDBACKS;
  } catch {
    return INITIAL_FEEDBACKS;
  }
}

function loadStoredVotes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VOTED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useStudentFeedback() {
  const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>(loadStoredFeedback);
  const [votedIds, setVotedIds] = useState<string[]>(loadStoredVotes);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks));
    } catch {
      // storage quota or incognito
    }
  }, [feedbacks]);

  useEffect(() => {
    try {
      localStorage.setItem(VOTED_KEY, JSON.stringify(votedIds));
    } catch {
      // storage quota or incognito
    }
  }, [votedIds]);

  const addFeedback = useCallback(
    (input: {
      title: string;
      content: string;
      category: FeedbackCategory;
      rating: number;
      building: string;
      authorName: string;
      authorDepartment: string;
      isAnonymous: boolean;
    }): StudentFeedback => {
      const newEntry: StudentFeedback = {
        id: `FB-${Date.now().toString().slice(-4)}`,
        title: input.title.trim(),
        content: input.content.trim(),
        category: input.category,
        rating: Math.max(1, Math.min(5, input.rating)),
        building: input.building || "General Campus",
        authorName: input.isAnonymous ? "Verified Campus Resident" : input.authorName,
        authorDepartment: input.isAnonymous ? "Campus" : input.authorDepartment,
        isAnonymous: input.isAnonymous,
        createdAt: new Date().toISOString().slice(0, 10),
        helpfulVotes: 0,
        adminStatus: "Under Review",
      };

      setFeedbacks((prev) => [newEntry, ...prev]);
      return newEntry;
    },
    [],
  );

  const voteHelpful = useCallback(
    (id: string): boolean => {
      if (votedIds.includes(id)) return false;

      setVotedIds((prev) => [...prev, id]);
      setFeedbacks((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, helpfulVotes: item.helpfulVotes + 1 } : item,
        ),
      );
      return true;
    },
    [votedIds],
  );

  const stats = {
    totalCount: feedbacks.length,
    averageRating: feedbacks.length
      ? Number((feedbacks.reduce((acc, f) => acc + f.rating, 0) / feedbacks.length).toFixed(1))
      : 5.0,
    positivePercent: feedbacks.length
      ? Math.round(
          (feedbacks.filter((f) => f.rating >= 4).length / feedbacks.length) * 100,
        )
      : 100,
    fiveStarCount: feedbacks.filter((f) => f.rating === 5).length,
  };

  return {
    feedbacks,
    votedIds,
    addFeedback,
    voteHelpful,
    stats,
  };
}
