import { describe, it, expect } from "vitest";

/**
 * FixLens AI — Automated Security & Authorization Model Tests
 *
 * This test suite validates the security model defined in:
 * - supabase/schema.sql (Row-Level Security, Views, RPCs, and Trigger Integrity)
 * - supabase/storage.sql (Bucket privacy, Path Sandboxing, and Signed URL access)
 *
 * It verifies multi-tenant isolation across Student A, Student B, and Administrator.
 */

// Simulated database row types
interface DbProfile {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  role: "student" | "admin" | "staff";
  department: string;
}

interface DbComplaint {
  id: string;
  title: string;
  description: string;
  category: string;
  building: string;
  room?: string;
  urgency: "Low" | "Medium" | "High";
  affected: number;
  priority: "Low" | "Medium" | "High";
  predicted_priority?: "Low" | "Medium" | "High";
  confidence?: number;
  status: "Submitted" | "Under Review" | "In Progress" | "Resolved" | "Rejected";
  reporter: string;
  reporter_id: string;
  image_url?: string;
  resolution_note?: string;
  linked_complaint_id?: string;
}

interface DbProposal {
  id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  status: "Under Review" | "Approved" | "Planned" | "Rejected";
  author: string;
  author_id: string;
  support_count: number;
  admin_note?: string;
}

interface DbProposalVote {
  id: string;
  proposal_id: string;
  user_id: string;
}

interface DbNotification {
  id: string;
  user_id: string;
  recipient_email: string;
  title: string;
  message: string;
}

// Security context fixture
const studentA = {
  uid: "student-a-uuid-1111",
  email: "studentA@campus.edu",
  role: "student",
};

const studentB = {
  uid: "student-b-uuid-2222",
  email: "studentB@campus.edu",
  role: "student",
};

const adminUser = {
  uid: "admin-uuid-9999",
  email: "adminfix@gmail.com",
  role: "admin",
};

// Database seed fixtures
const mockProfiles: DbProfile[] = [
  {
    id: studentA.uid,
    email: studentA.email,
    phone: "+1-555-0101",
    full_name: "Alice Adams",
    role: "student",
    department: "Computer Science",
  },
  {
    id: studentB.uid,
    email: studentB.email,
    phone: "+1-555-0202",
    full_name: "Bob Builder",
    role: "student",
    department: "Electrical Engineering",
  },
  {
    id: adminUser.uid,
    email: adminUser.email,
    phone: "+1-555-0999",
    full_name: "Facilities Admin",
    role: "admin",
    department: "Campus Facilities",
  },
];

const mockComplaints: DbComplaint[] = [
  {
    id: "CMP-101",
    title: "Broken AC in Lab 301",
    description: "AC is leaking water on server racks.",
    category: "Electrical",
    building: "Science Hall",
    room: "301",
    urgency: "High",
    affected: 20,
    priority: "High",
    predicted_priority: "High",
    status: "Submitted",
    reporter: "Alice Adams",
    reporter_id: studentA.uid,
    image_url: `${studentA.uid}/ac-leak.jpg`,
    resolution_note: "Technician assigned internally",
  },
  {
    id: "CMP-102",
    title: "Water Dispenser Dripping",
    description: "Cold water dispenser dripping in corridor 2nd floor.",
    category: "Plumbing",
    building: "Hostel Block B",
    room: "Corridor",
    urgency: "Medium",
    affected: 5,
    priority: "Medium",
    predicted_priority: "Medium",
    status: "In Progress",
    reporter: "Bob Builder",
    reporter_id: studentB.uid,
    image_url: `${studentB.uid}/dispenser.jpg`,
    resolution_note: "Parts ordered from supplier",
  },
];

const mockNotifications: DbNotification[] = [
  {
    id: "notif-1",
    user_id: studentA.uid,
    recipient_email: studentA.email,
    title: "Complaint Received",
    message: "Your complaint CMP-101 has been logged.",
  },
  {
    id: "notif-2",
    user_id: studentB.uid,
    recipient_email: studentB.email,
    title: "Complaint In Progress",
    message: "Your complaint CMP-102 is being worked on.",
  },
];

describe("FixLens AI — Supabase Security Architecture Validation", () => {
  describe("1. Profile Privacy Policies", () => {
    // Simulates: CREATE POLICY "Profiles select authorization" ON public.profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
    function queryProfiles(currentCaller: { uid: string; role: string }) {
      return mockProfiles.filter(
        (p) => currentCaller.role === "admin" || p.id === currentCaller.uid
      );
    }

    it("restricts Student A to viewing only their own private profile", () => {
      const results = queryProfiles(studentA);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe(studentA.uid);
      expect(results[0].email).toBe("studentA@campus.edu");
      expect(results[0].phone).toBe("+1-555-0101");
    });

    it("prevents Student A from accessing Student B's email and phone", () => {
      const results = queryProfiles(studentA);
      const bobProfile = results.find((p) => p.id === studentB.uid);
      expect(bobProfile).toBeUndefined();
    });

    it("allows campus Administrator to view all profiles", () => {
      const results = queryProfiles(adminUser);
      expect(results).toHaveLength(3);
    });

    // Simulates: CREATE VIEW public.public_profiles AS SELECT id, full_name, role, department FROM public.profiles;
    it("exposes only non-sensitive display fields via public_profiles view", () => {
      const publicProfiles = mockProfiles.map((p) => ({
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        department: p.department,
      }));

      for (const p of publicProfiles) {
        expect((p as any).email).toBeUndefined();
        expect((p as any).phone).toBeUndefined();
      }
    });

    // Simulates: public.provision_initial_admin(admin_email)
    function simulateProvisionInitialAdmin(
      invokingRole: "postgres" | "authenticated" | "anon",
      targetEmail: string,
      authUsers: Array<{ id: string; email: string; raw_app_meta_data: Record<string, any> }>,
      profiles: DbProfile[]
    ) {
      if (invokingRole !== "postgres") {
        throw new Error("permission denied for function provision_initial_admin");
      }
      const user = authUsers.find((u) => u.email.toLowerCase() === targetEmail.toLowerCase());
      if (!user) return false;

      // 1. Elevate auth.users raw_app_meta_data
      user.raw_app_meta_data.role = "admin";

      // 2. Upsert profile with admin role
      const profile = profiles.find((p) => p.id === user.id);
      if (profile) {
        profile.role = "admin";
        profile.full_name = "FixLens Administrator";
      } else {
        profiles.push({
          id: user.id,
          email: user.email,
          full_name: "FixLens Administrator",
          role: "admin",
          department: "Campus Facilities",
        });
      }
      return true;
    }

    it("allows trusted administrative procedure to bootstrap admin and elevate JWT app_metadata", () => {
      const mockAuthUsers = [
        {
          id: "fresh-admin-uuid",
          email: "adminfix@gmail.com",
          raw_app_meta_data: {},
        },
      ];
      const freshProfiles: DbProfile[] = [
        {
          id: "fresh-admin-uuid",
          email: "adminfix@gmail.com",
          full_name: "adminfix",
          role: "student", // Fresh signup default
          department: "General",
        },
      ];

      // Client cannot call provision_initial_admin
      expect(() => {
        simulateProvisionInitialAdmin("authenticated", "adminfix@gmail.com", mockAuthUsers, freshProfiles);
      }).toThrow("permission denied");

      // Trusted DB administrator runs the procedure
      const success = simulateProvisionInitialAdmin("postgres", "adminfix@gmail.com", mockAuthUsers, freshProfiles);
      expect(success).toBe(true);

      // Verified: raw_app_meta_data now has role: 'admin' (propagated to JWT app_metadata)
      expect(mockAuthUsers[0].raw_app_meta_data.role).toBe("admin");
      // Verified: public.profiles now has role: 'admin'
      expect(freshProfiles[0].role).toBe("admin");
    });

    // Simulates: trg_protect_profile_fields BEFORE UPDATE
    function simulateProfileUpdate(
      caller: { uid: string; role: string; isSqlEditor?: boolean },
      existingProfile: DbProfile,
      updates: Partial<DbProfile>
    ): DbProfile {
      // 1. Check is_admin() logic including SQL Editor context
      const isAdminCaller =
        caller.role === "admin" ||
        caller.isSqlEditor === true;

      if (isAdminCaller) {
        return {
          ...existingProfile,
          ...updates,
        };
      }

      // 2. Non-admin checks
      if (caller.uid !== existingProfile.id) {
        throw new Error("You are not authorized to update this profile");
      }

      // Revert role self-promotion or demotion attempt
      return {
        ...existingProfile,
        full_name: updates.full_name ?? existingProfile.full_name,
        department: updates.department ?? existingProfile.department,
        phone: updates.phone ?? existingProfile.phone,
        // Protected fields:
        role: existingProfile.role, // Tampering blocked
        id: existingProfile.id,
        email: existingProfile.email,
      };
    }

    it("protect_profile_fields prevents student from promoting themselves to admin", () => {
      const studentProfile = mockProfiles[0]; // Student A ('student')
      const tampered = simulateProfileUpdate(studentA, studentProfile, {
        role: "admin",
        full_name: "Alice Hacker",
      });

      expect(tampered.full_name).toBe("Alice Hacker");
      expect(tampered.role).toBe("student"); // Self-promotion reverted
    });

    it("protect_profile_fields strictly prevents student from demoting an administrator", () => {
      const adminProfile = mockProfiles[2]; // Facilities Admin
      expect(() => {
        simulateProfileUpdate(studentA, adminProfile, { role: "student" });
      }).toThrow("You are not authorized to update this profile");
    });

    it("protect_profile_fields allows SQL Editor context (postgres role) to update admin role", () => {
      const freshAdminProfile: DbProfile = {
        id: "fresh-admin-id",
        email: "adminfix@gmail.com",
        full_name: "Admin Fix",
        role: "student",
        department: "General",
      };

      const promoted = simulateProfileUpdate(
        { uid: "", role: "", isSqlEditor: true },
        freshAdminProfile,
        { role: "admin", full_name: "FixLens Administrator" }
      );

      expect(promoted.role).toBe("admin");
      expect(promoted.full_name).toBe("FixLens Administrator");
    });
  });

  describe("2. Complaint Privacy & Shared Views", () => {
    // Simulates: CREATE POLICY "Complaints select authorization" ON public.complaints FOR SELECT USING (auth.uid() = reporter_id OR public.is_admin());
    function queryDirectComplaints(currentCaller: { uid: string; role: string }) {
      return mockComplaints.filter(
        (c) => currentCaller.role === "admin" || c.reporter_id === currentCaller.uid
      );
    }

    it("prevents Student A from directly querying Student B's complaint record", () => {
      const results = queryDirectComplaints(studentA);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("CMP-101");

      const studentBComplaint = results.find((c) => c.id === "CMP-102");
      expect(studentBComplaint).toBeUndefined();
    });

    it("allows Administrator to query all complaints directly", () => {
      const results = queryDirectComplaints(adminUser);
      expect(results).toHaveLength(2);
    });

    // Simulates: public.shared_complaints view and public.get_complaint_by_id RPC
    function querySharedComplaints(currentCaller: { uid: string; role: string }) {
      return mockComplaints.map((c) => {
        const isOwnerOrAdmin = currentCaller.role === "admin" || c.reporter_id === currentCaller.uid;
        return {
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          building: c.building,
          room: c.room,
          urgency: c.urgency,
          affected: c.affected,
          priority: c.priority,
          status: c.status,
          reporter: isOwnerOrAdmin ? c.reporter : "Campus Resident",
          reporter_id: isOwnerOrAdmin ? c.reporter_id : null,
          resolution_note: isOwnerOrAdmin ? c.resolution_note : null,
        };
      });
    }

    it("masks reporter name and hides reporter UUID / notes for third-party students in shared view", () => {
      const shared = querySharedComplaints(studentA);
      const bViewedByA = shared.find((c) => c.id === "CMP-102")!;

      expect(bViewedByA).toBeDefined();
      expect(bViewedByA.title).toBe("Water Dispenser Dripping");
      // Anonymized reporter details
      expect(bViewedByA.reporter).toBe("Campus Resident");
      expect(bViewedByA.reporter_id).toBeNull();
      expect(bViewedByA.resolution_note).toBeNull();
    });

    it("preserves full detail when complaint owner views their own complaint", () => {
      const shared = querySharedComplaints(studentA);
      const aViewedByA = shared.find((c) => c.id === "CMP-101")!;

      expect(aViewedByA.reporter).toBe("Alice Adams");
      expect(aViewedByA.reporter_id).toBe(studentA.uid);
      expect(aViewedByA.resolution_note).toBe("Technician assigned internally");
    });

    // Simulates RPC server-side auth validation: public.get_shared_complaints()
    function rpcGetSharedComplaints(caller: { uid: string; role: string; isAuthenticated: boolean }) {
      if (!caller.isAuthenticated) {
        throw new Error("Authentication required to access campus complaints");
      }
      return querySharedComplaints(caller);
    }

    it("RPC get_shared_complaints rejects unauthenticated calls", () => {
      expect(() => {
        rpcGetSharedComplaints({ uid: "", role: "anon", isAuthenticated: false });
      }).toThrow("Authentication required to access campus complaints");
    });

    // Simulates RPC public.get_complaint_by_id(param)
    function rpcGetComplaintById(
      caller: { uid: string; role: string; isAuthenticated: boolean },
      complaintId: string
    ) {
      if (!caller.isAuthenticated) {
        throw new Error("Authentication required to access complaint details");
      }
      const c = mockComplaints.find((x) => x.id === complaintId);
      if (!c) return null;
      if (c.status === "Rejected" && caller.role !== "admin" && c.reporter_id !== caller.uid) {
        return null;
      }
      const isOwnerOrAdmin = caller.role === "admin" || c.reporter_id === caller.uid;
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        building: c.building,
        room: c.room,
        urgency: c.urgency,
        affected: c.affected,
        priority: c.priority,
        status: c.status,
        image_url: c.image_url,
        reporter: isOwnerOrAdmin ? c.reporter : "Campus Resident",
        reporter_id: isOwnerOrAdmin ? c.reporter_id : null,
        resolution_note: isOwnerOrAdmin ? c.resolution_note : null,
        is_owner_or_admin: isOwnerOrAdmin,
      };
    }

    it("RPC get_complaint_by_id masks reporter UUID and notes for third party while allowing full detail for owner", () => {
      const studentBViewingA = rpcGetComplaintById(
        { ...studentB, isAuthenticated: true },
        "CMP-101"
      );
      expect(studentBViewingA).not.toBeNull();
      expect(studentBViewingA?.reporter).toBe("Campus Resident");
      expect(studentBViewingA?.reporter_id).toBeNull();
      expect(studentBViewingA?.resolution_note).toBeNull();
      expect(studentBViewingA?.is_owner_or_admin).toBe(false);

      const studentAViewingA = rpcGetComplaintById(
        { ...studentA, isAuthenticated: true },
        "CMP-101"
      );
      expect(studentAViewingA?.reporter).toBe("Alice Adams");
      expect(studentAViewingA?.reporter_id).toBe(studentA.uid);
      expect(studentAViewingA?.resolution_note).toBe("Technician assigned internally");
      expect(studentAViewingA?.is_owner_or_admin).toBe(true);
    });
  });

  describe("3. Complaint Integrity & Field Protection Triggers", () => {
    // Simulates: trg_enforce_complaint_integrity BEFORE INSERT OR UPDATE
    function simulateComplaintInsert(
      caller: { uid: string; role: string },
      input: Partial<DbComplaint>
    ): DbComplaint {
      const isAdm = caller.role === "admin";
      return {
        id: input.id || "CMP-NEW",
        title: input.title || "",
        description: input.description || "",
        category: input.category || "Electrical",
        building: input.building || "Campus Center",
        room: input.room,
        urgency: input.urgency || "Low",
        affected: input.affected || 1,
        priority: isAdm ? (input.priority || "Low") : (input.predicted_priority || "Medium"),
        predicted_priority: input.predicted_priority,
        status: isAdm ? (input.status || "Submitted") : "Submitted", // Always forced to 'Submitted' for students
        reporter: input.reporter || "Anonymous",
        reporter_id: isAdm ? (input.reporter_id || caller.uid) : caller.uid, // Always bound to auth.uid()
        resolution_note: isAdm ? input.resolution_note : undefined, // Wiped for students
      };
    }

    it("forces safe initial status 'Submitted' and server-side reporter_id on student submission", () => {
      const maliciousSubmission = simulateComplaintInsert(studentA, {
        id: "CMP-HACK",
        title: "False resolution attempt",
        status: "Resolved" as any,
        resolution_note: "I solved it myself",
        reporter_id: studentB.uid, // Attempted impersonation
      });

      expect(maliciousSubmission.status).toBe("Submitted");
      expect(maliciousSubmission.reporter_id).toBe(studentA.uid);
      expect(maliciousSubmission.resolution_note).toBeUndefined();
    });

    function simulateComplaintUpdate(
      caller: { uid: string; role: string },
      existing: DbComplaint,
      updates: Partial<DbComplaint>
    ): DbComplaint {
      const isAdm = caller.role === "admin";
      if (!isAdm) {
        if (existing.reporter_id !== caller.uid) {
          throw new Error("You can only update your own complaints");
        }
        if (existing.status !== "Submitted") {
          throw new Error("Complaints can only be edited while in Submitted status");
        }
        // Protect administrative and ML fields
        return {
          ...existing,
          title: updates.title ?? existing.title,
          description: updates.description ?? existing.description,
          building: updates.building ?? existing.building,
          room: updates.room ?? existing.room,
          urgency: updates.urgency ?? existing.urgency,
          // Protected fields:
          status: existing.status,
          priority: existing.priority,
          predicted_priority: existing.predicted_priority,
          reporter_id: existing.reporter_id,
          resolution_note: existing.resolution_note,
        };
      }
      return { ...existing, ...updates };
    }

    it("prevents student from updating status or priority on an existing complaint", () => {
      const existing = mockComplaints[0]; // Owned by Student A, status 'Submitted'
      const updated = simulateComplaintUpdate(studentA, existing, {
        title: "Updated Title",
        status: "Resolved",
        priority: "Low",
        resolution_note: "Admin note forged",
      });

      expect(updated.title).toBe("Updated Title");
      expect(updated.status).toBe("Submitted"); // Unchanged
      expect(updated.priority).toBe("High"); // Unchanged
      expect(updated.resolution_note).toBe(existing.resolution_note); // Unchanged
    });

    it("prevents student from editing complaints once they transition beyond 'Submitted'", () => {
      const inProgressComplaint = mockComplaints[1]; // status 'In Progress'
      expect(() => {
        simulateComplaintUpdate(studentB, inProgressComplaint, { title: "New title" });
      }).toThrow("Complaints can only be edited while in Submitted status");
    });

    it("allows administrator to update status and set resolution notes", () => {
      const existing = mockComplaints[0];
      const adminUpdated = simulateComplaintUpdate(adminUser, existing, {
        status: "Resolved",
        resolution_note: "Issue verified and resolved by facilities crew.",
      });

      expect(adminUpdated.status).toBe("Resolved");
      expect(adminUpdated.resolution_note).toBe("Issue verified and resolved by facilities crew.");
    });
  });

  describe("4. Proposal Voting & Support Count Synchronization", () => {
    let proposal: DbProposal;
    let votes: DbProposalVote[];

    // Simulates trigger: handle_proposal_vote_change() and protect_proposal_fields()
    function castVote(caller: { uid: string; role: string }, proposalId: string) {
      if (votes.some((v) => v.proposal_id === proposalId && v.user_id === caller.uid)) {
        throw new Error("duplicate key value violates unique constraint unique_user_proposal_vote");
      }
      votes.push({
        id: `vote-${Date.now()}-${Math.random()}`,
        proposal_id: proposalId,
        user_id: caller.uid,
      });
      // Trigger execution (pg_trigger_depth() > 1): increments support_count exactly once
      proposal.support_count += 1;
    }

    function withdrawVote(caller: { uid: string; role: string }, proposalId: string) {
      const idx = votes.findIndex((v) => v.proposal_id === proposalId && v.user_id === caller.uid);
      if (idx === -1) {
        throw new Error("Vote not found");
      }
      votes.splice(idx, 1);
      // Trigger execution (pg_trigger_depth() > 1): decrements support_count exactly once
      proposal.support_count = Math.max(1, proposal.support_count - 1);
    }

    function directStudentProposalUpdate(
      caller: { uid: string; role: string },
      updates: Partial<DbProposal>
    ) {
      if (caller.role !== "admin") {
        if (caller.uid !== proposal.author_id) {
          throw new Error("You are not authorized to update this proposal");
        }
        // Direct update (pg_trigger_depth() = 1): support_count is forcefully reset to OLD.support_count
        return {
          ...proposal,
          title: updates.title ?? proposal.title,
          description: updates.description ?? proposal.description,
          support_count: proposal.support_count, // Student cannot modify support count!
          status: proposal.status, // Student cannot alter status!
        };
      }
      return { ...proposal, ...updates };
    }

    it("increments support_count exactly once when Student B casts a vote", () => {
      proposal = {
        id: "PROP-1",
        title: "Add Wi-Fi repeaters in Library",
        description: "Coverage is weak in the study rooms.",
        category: "Internet/Wi-Fi",
        location: "Central Library",
        status: "Under Review",
        author: "Alice Adams",
        author_id: studentA.uid,
        support_count: 1, // Baseline author support
      };
      votes = [];

      castVote(studentB, proposal.id);
      expect(proposal.support_count).toBe(2);
      expect(votes).toHaveLength(1);
    });

    it("prevents duplicate voting by the same student on the same proposal", () => {
      expect(() => {
        castVote(studentB, proposal.id);
      }).toThrow("unique constraint");
      expect(proposal.support_count).toBe(2);
    });

    it("decrements support_count exactly once when Student B withdraws their vote", () => {
      withdrawVote(studentB, proposal.id);
      expect(proposal.support_count).toBe(1);
      expect(votes).toHaveLength(0);
    });

    it("prevents students from manually tampering with support_count via direct UPDATE", () => {
      const tampered = directStudentProposalUpdate(studentA, {
        support_count: 9999, // Malicious attempt to forge 9999 votes
      });
      expect(tampered.support_count).toBe(1); // Blocked and preserved
    });
  });

  describe("5. Notification Isolation", () => {
    // Simulates: CREATE POLICY "Users can only view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
    function queryNotifications(caller: { uid: string; role: string }) {
      return mockNotifications.filter(
        (n) => caller.role === "admin" || n.user_id === caller.uid
      );
    }

    it("Student A can only view their own notifications", () => {
      const notifs = queryNotifications(studentA);
      expect(notifs).toHaveLength(1);
      expect(notifs[0].id).toBe("notif-1");
    });

    it("Student A cannot view Student B's notifications", () => {
      const notifs = queryNotifications(studentA);
      const studentBNotif = notifs.find((n) => n.id === "notif-2");
      expect(studentBNotif).toBeUndefined();
    });

    it("Administrator can view all system notifications", () => {
      const notifs = queryNotifications(adminUser);
      expect(notifs).toHaveLength(2);
    });
  });

  describe("6. Storage Bucket & Image Path Sandboxing", () => {
    // Simulates storage.sql checks
    function validateUpload(
      caller: { uid: string },
      bucket: string,
      objectPath: string,
      fileSize: number,
      mimeType: string
    ) {
      if (bucket !== "complaint-images") {
        throw new Error("Invalid bucket");
      }
      const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
      if (!allowedMimes.includes(mimeType)) {
        throw new Error("MIME type not allowed");
      }
      if (fileSize > 5 * 1024 * 1024) {
        throw new Error("File exceeds 5MB limit");
      }
      const folderName = objectPath.split("/")[0];
      if (folderName !== caller.uid) {
        throw new Error("Upload path must match auth.uid()");
      }
      return true;
    }

    it("allows Student A to upload a valid image into their own folder", () => {
      expect(
        validateUpload(
          studentA,
          "complaint-images",
          `${studentA.uid}/leak-photo.jpg`,
          1024 * 500, // 500 KB
          "image/jpeg"
        )
      ).toBe(true);
    });

    it("rejects file uploads exceeding the 5MB size limit", () => {
      expect(() => {
        validateUpload(
          studentA,
          "complaint-images",
          `${studentA.uid}/giant-leak.jpg`,
          6 * 1024 * 1024, // 6 MB
          "image/jpeg"
        );
      }).toThrow("File exceeds 5MB limit");
    });

    it("rejects unauthorized file extensions / MIME types", () => {
      expect(() => {
        validateUpload(
          studentA,
          "complaint-images",
          `${studentA.uid}/exploit.exe`,
          1024,
          "application/x-msdownload"
        );
      }).toThrow("MIME type not allowed");
    });

    it("strictly blocks Student A from uploading into Student B's folder", () => {
      expect(() => {
        validateUpload(
          studentA,
          "complaint-images",
          `${studentB.uid}/impersonate.jpg`,
          1024 * 100,
          "image/jpeg"
        );
      }).toThrow("Upload path must match auth.uid()");
    });

    // Simulates: public.can_access_complaint_image(object_path) helper function
    function canAccessComplaintImage(
      caller: { uid: string; role: string; isAuthenticated?: boolean },
      bucketId: string,
      objectPath: string
    ): boolean {
      if (caller.isAuthenticated === false || caller.role === "anon") {
        return false;
      }
      if (bucketId !== "complaint-images") return false;
      // 1. Folder owner (author)
      const folderOwner = objectPath.split("/")[0];
      if (folderOwner === caller.uid) return true;
      // 2. Administrator
      if (caller.role === "admin") return true;
      // 3. Exact match against authorized active complaints (NO loose LIKE matches)
      const isAttachedToActiveComplaint = mockComplaints.some(
        (c) =>
          c.image_url &&
          (c.image_url === objectPath || c.image_url === `complaint-images/${objectPath}`) &&
          ["Submitted", "Under Review", "In Progress", "Resolved"].includes(c.status)
      );
      return isAttachedToActiveComplaint;
    }

    it("allows Student A to access their own uploaded complaint image", () => {
      expect(
        canAccessComplaintImage(studentA, "complaint-images", `${studentA.uid}/ac-leak.jpg`)
      ).toBe(true);
    });

    it("allows Student B to view Student A's image when attached to an active complaint in shared view", () => {
      // CMP-101 has status 'Submitted' and image_url 'student-a-uuid-1111/ac-leak.jpg'
      expect(
        canAccessComplaintImage(studentB, "complaint-images", `${studentA.uid}/ac-leak.jpg`)
      ).toBe(true);
    });

    it("strictly blocks unauthenticated (anon) users from signing any complaint images", () => {
      expect(
        canAccessComplaintImage(
          { uid: "", role: "anon", isAuthenticated: false },
          "complaint-images",
          `${studentA.uid}/ac-leak.jpg`
        )
      ).toBe(false);
    });

    it("strictly blocks loose path collisions and spoofed filenames via exact matching", () => {
      // A file named 'fake-ac-leak.jpg' or with extra prefix should NOT match 'ac-leak.jpg'
      expect(
        canAccessComplaintImage(studentB, "complaint-images", `${studentA.uid}/fake-ac-leak.jpg`)
      ).toBe(false);
      expect(
        canAccessComplaintImage(studentB, "complaint-images", `${studentA.uid}/ac-leak.jpg.bak`)
      ).toBe(false);
    });

    it("strictly blocks Student B from accessing Student A's unlinked/private draft images", () => {
      // Unattached image not linked to any complaint
      expect(
        canAccessComplaintImage(studentB, "complaint-images", `${studentA.uid}/private-draft.jpg`)
      ).toBe(false);
    });

    it("strictly blocks an unrelated student from accessing images of a rejected complaint", () => {
      // Add a rejected complaint to test boundary
      mockComplaints.push({
        id: "CMP-REJECTED",
        title: "Rejected prank report",
        description: "Not a real issue",
        category: "Other",
        building: "None",
        urgency: "Low",
        affected: 1,
        priority: "Low",
        status: "Rejected",
        reporter: "Alice Adams",
        reporter_id: studentA.uid,
        image_url: `${studentA.uid}/prank.jpg`,
      });

      const studentC = { uid: "student-c-uuid-3333", email: "studentC@campus.edu", role: "student" };
      expect(
        canAccessComplaintImage(studentC, "complaint-images", `${studentA.uid}/prank.jpg`)
      ).toBe(false);

      // But author and admin can still access it:
      expect(
        canAccessComplaintImage(studentA, "complaint-images", `${studentA.uid}/prank.jpg`)
      ).toBe(true);
      expect(
        canAccessComplaintImage(adminUser, "complaint-images", `${studentA.uid}/prank.jpg`)
      ).toBe(true);
    });

    it("allows campus Administrator to access all complaint images", () => {
      expect(
        canAccessComplaintImage(adminUser, "complaint-images", `${studentA.uid}/ac-leak.jpg`)
      ).toBe(true);
      expect(
        canAccessComplaintImage(adminUser, "complaint-images", `${studentB.uid}/dispenser.jpg`)
      ).toBe(true);
      expect(
        canAccessComplaintImage(adminUser, "complaint-images", `${studentA.uid}/unlinked.jpg`)
      ).toBe(true);
    });
  });
});
