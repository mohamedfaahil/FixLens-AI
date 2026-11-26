import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/fixlens/ui-bits";
import { StudentFeedbackView } from "@/components/fixlens/StudentFeedbackView";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/student/feedback")({
  head: () =>
    pageHead(
      "Student Feedback",
      "Share your rating, reviews, and suggestions on campus maintenance and facilities.",
    ),
  component: StudentFeedbackPage,
});

function StudentFeedbackPage() {
  return (
    <>
      <PageHeader
        title="Student Feedback"
        description="Rate maintenance resolution speed, facility hygiene, and campus services."
      />
      <StudentFeedbackView />
    </>
  );
}
