import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudentFeedback, FEEDBACK_CATEGORIES } from "../lib/feedback-store";

describe("FixLens AI — Student Feedback Module", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loads initial campus feedbacks and provides correct statistics", () => {
    const { result } = renderHook(() => useStudentFeedback());

    expect(result.current.feedbacks.length).toBeGreaterThan(0);
    expect(result.current.stats.totalCount).toBe(result.current.feedbacks.length);
    expect(result.current.stats.averageRating).toBeGreaterThanOrEqual(1);
    expect(result.current.stats.averageRating).toBeLessThanOrEqual(5);
    expect(result.current.stats.positivePercent).toBeGreaterThan(0);
  });

  it("allows students to submit new campus feedback with ratings and buildings", () => {
    const { result } = renderHook(() => useStudentFeedback());

    const initialCount = result.current.feedbacks.length;

    act(() => {
      result.current.addFeedback({
        title: "Clean water dispenser installed in CS Block",
        content: "Water filters are fresh and the cooler is functioning perfectly.",
        category: "Restrooms & Water Services",
        rating: 5,
        building: "CS Block",
        authorName: "Mohamed Faahil",
        authorDepartment: "Computer Applications (MCA)",
        isAnonymous: false,
      });
    });

    expect(result.current.feedbacks.length).toBe(initialCount + 1);
    const newest = result.current.feedbacks[0];
    expect(newest.title).toBe("Clean water dispenser installed in CS Block");
    expect(newest.building).toBe("CS Block");
    expect(newest.rating).toBe(5);
    expect(newest.adminStatus).toBe("Under Review");
  });

  it("supports anonymous submissions by protecting reporter identity", () => {
    const { result } = renderHook(() => useStudentFeedback());

    act(() => {
      result.current.addFeedback({
        title: "Dim lighting in Annexure Block staircase",
        content: "Staircase lighting between 1st and 2nd floor is dim after 6 PM.",
        category: "Facility Maintenance & Cleanliness",
        rating: 3,
        building: "Annexure Block",
        authorName: "Private Student",
        authorDepartment: "Computer Science",
        isAnonymous: true,
      });
    });

    const newest = result.current.feedbacks[0];
    expect(newest.isAnonymous).toBe(true);
    expect(newest.authorName).toBe("Verified Campus Resident");
    expect(newest.authorDepartment).toBe("Campus");
  });

  it("allows upvoting feedback as helpful and prevents duplicate voting", () => {
    const { result } = renderHook(() => useStudentFeedback());
    const targetId = result.current.feedbacks[0].id;
    const initialVotes = result.current.feedbacks[0].helpfulVotes;

    let firstVoteSuccess = false;
    act(() => {
      firstVoteSuccess = result.current.voteHelpful(targetId);
    });

    expect(firstVoteSuccess).toBe(true);
    const updated = result.current.feedbacks.find((f) => f.id === targetId);
    expect(updated?.helpfulVotes).toBe(initialVotes + 1);

    // Duplicate vote attempt
    let secondVoteSuccess = true;
    act(() => {
      secondVoteSuccess = result.current.voteHelpful(targetId);
    });

    expect(secondVoteSuccess).toBe(false);
  });
});
