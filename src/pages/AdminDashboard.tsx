import { useState, useEffect } from "react";
import {
  Shield,
  Users,
  User,
  FileText,
  Trash2,
  Search,
  MessageSquare,
  Activity,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { handleFirestoreError, OperationType } from "../utils/errorHandling";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "../lib/utils";

import { Skeleton } from "../components/ui/Skeleton";

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  photoURL?: string;
  createdAt?: any;
  lastLoginAt?: any;
}

interface FieldReport {
  id: string;
  userId: string;
  author: string;
  type: string;
  scenario: string;
  action: string;
  result: string;
  timestamp: any;
  likes: number;
  commentCount?: number;
}

interface Feedback {
  id: string;
  userId?: string;
  userName?: string;
  email?: string;
  type: string;
  message: string;
  createdAt: any;
  url?: string;
  userAgent?: string;
}

export default function AdminDashboard() {
  const auth = useAuth();
  if (!auth) return <div>Loading...</div>;
  const { userData } = auth;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "users" | "reports" | "feedback"
  >("dashboard");
  const [users, setUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<FieldReport[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [feedbacksLoading, setFeedbacksLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (userData && userData.role !== "admin") {
      toast.error("Unauthorized access.");
      navigate("/");
      return;
    }
    fetchData().catch(err => {
      console.error("Unhandled error in AdminDashboard fetchData:", err);
    });
  }, [userData, navigate]);

  const fetchData = async () => {
    setUsersLoading(true);
    setReportsLoading(true);
    setFeedbacksLoading(true);
    try {
      const [usersResult, reportsResult, feedbackResult] =
        await Promise.all([
          supabase.from("users").select("*"),
          supabase.from("field_reports").select("*").order("timestamp", { ascending: false }),
          supabase.from("feedback").select("*").order("created_at", { ascending: false }),
        ]);

      if (usersResult.error) throw usersResult.error;
      if (reportsResult.error) throw reportsResult.error;
      if (feedbackResult.error) throw feedbackResult.error;

      const usersData = usersResult.data.map((user) => ({
        id: user.id,
        ...user,
      })) as UserData[];
      setUsers(usersData);
      setUsersLoading(false);

      const reportsData = reportsResult.data.map((report) => ({
        id: report.id,
        ...report,
      })) as FieldReport[];
      setReports(reportsData);
      setReportsLoading(false);

      const feedbackData = feedbackResult.data.map((feedback) => ({
        id: feedback.id,
        ...feedback,
      })) as Feedback[];
      setFeedbacks(feedbackData);
      setFeedbacksLoading(false);
    } catch (error: any) {
      console.error("Error fetching admin data:", error);
      toast.error("Failed to load data. Check permissions.");
      handleFirestoreError(error, OperationType.LIST, "users");
    } finally {
      setUsersLoading(false);
      setReportsLoading(false);
      setFeedbacksLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("users")
        .update({ role: newRole })
        .eq("id", userId);
      if (error) throw error;
      setUsers(
        users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      toast.success("User role updated successfully.");
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role.");
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const [confirmingDelete, setConfirmingDelete] = useState<{
    id: string;
    type: "report" | "feedback" | "user";
  } | null>(null);

  const handleDeleteUser = async (userId: string, force = false) => {
    if (userData?.uid === userId) {
      toast.error("You cannot delete your own admin account.");
      return;
    }

    if (!force && (confirmingDelete?.id !== userId || confirmingDelete?.type !== "user")) {
      setConfirmingDelete({ id: userId, type: "user" });
      toast("Click again to confirm user deletion", {
        action: {
          label: "Confirm",
          onClick: () => {
            handleDeleteUser(userId, true).catch(err => {
              console.error("User deletion failed:", err);
            });
          },
        },
      });
      return;
    }

    try {
      
      // Define all collections that might have data associated with this user
      const collectionsToDelete = [
        "field_reports",
        "field_report_comments",
        "report_likes",
        "calibrations",
        "oracle_analyses",
        "favorites",
        "dossiers",
        "advisor_sessions",
        "advisor_messages",
        "assessment_results",
        "feedback"
      ];

      // Delete data from all associated collections
      // Note: Tables with CASCADE constraints will be deleted automatically when user is deleted

      // Delete feedback separately (no CASCADE)
      await supabase.from("feedback").delete().eq("user_id", userId);

      // Delete the user (this will CASCADE delete related data)
      const { error: deleteError } = await supabase
        .from("users")
        .delete()
        .eq("id", userId);
      if (deleteError) throw deleteError;
      
      // Update local state
      setUsers(prev => prev.filter((u) => u.id !== userId));
      setReports(prev => prev.filter((r) => r.userId !== userId));
      
      toast.success("User account and all associated data deleted successfully.");
      setConfirmingDelete(null);
    } catch (error) {
      console.error("Error deleting user:", error);
      toast.error("Failed to delete user.");
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (confirmingDelete?.id !== reportId) {
      setConfirmingDelete({ id: reportId, type: "report" });
      toast("Click again to confirm deletion", {
        action: {
          label: "Confirm",
          onClick: () => {
            handleDeleteReport(reportId).catch(err => {
              console.error("Report deletion failed:", err);
            });
          },
        },
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("field_reports")
        .delete()
        .eq("id", reportId);
      if (error) throw error;
      setReports(reports.filter((r) => r.id !== reportId));
      toast.success("Report deleted successfully.");
      setConfirmingDelete(null);
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error("Failed to delete report.");
      handleFirestoreError(error, OperationType.DELETE, `field_reports/${reportId}`);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (confirmingDelete?.id !== feedbackId) {
      setConfirmingDelete({ id: feedbackId, type: "feedback" });
      toast("Click again to confirm deletion", {
        action: {
          label: "Confirm",
          onClick: () => {
            handleDeleteFeedback(feedbackId).catch(err => {
              console.error("Feedback deletion failed:", err);
            });
          },
        },
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("feedback")
        .delete()
        .eq("id", feedbackId);
      if (error) throw error;
      setFeedbacks(feedbacks.filter((f) => f.id !== feedbackId));
      toast.success("Feedback deleted successfully.");
      setConfirmingDelete(null);
    } catch (error) {
      console.error("Error deleting feedback:", error);
      toast.error("Failed to delete feedback.");
      handleFirestoreError(error, OperationType.DELETE, `feedback/${feedbackId}`);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredReports = reports.filter(
    (r) =>
      r.scenario?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.result?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.type?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredFeedbacks = feedbacks.filter(
    (f) =>
      f.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.type?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const stats = [
    {
      label: "Total Users",
      value: users.length,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-400/10",
    },
    {
      label: "Field Reports",
      value: reports.length,
      icon: FileText,
      color: "text-orange-400",
      bg: "bg-orange-400/10",
    },
    {
      label: "User Feedback",
      value: feedbacks.length,
      icon: MessageSquare,
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      label: "Admins",
      value: users.filter((u) => u.role === "admin").length,
      icon: Shield,
      color: "text-red-400",
      bg: "bg-red-400/10",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <div className="w-12 h-12 rounded-xl accent-gradient flex items-center justify-center">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400">
            Manage users and moderate community content.
          </p>
        </div>
      </div>

      <div className="flex gap-2 sm:gap-4 border-b border-white/10 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab("dashboard")}
          className={`whitespace-nowrap shrink-0 px-4 sm:px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === "dashboard"
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Overview
          </div>
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`whitespace-nowrap shrink-0 px-4 sm:px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === "users"
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            User Management
          </div>
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`whitespace-nowrap shrink-0 px-4 sm:px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === "reports"
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Content Moderation
          </div>
        </button>
        <button
          onClick={() => setActiveTab("feedback")}
          className={`whitespace-nowrap shrink-0 px-4 sm:px-6 py-2 rounded-lg font-medium transition-all ${
            activeTab === "feedback"
              ? "bg-accent-primary/20 text-accent-primary border border-accent-primary/30"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            User Feedback
          </div>
        </button>

      </div>

      {activeTab !== "dashboard" && (
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-5 h-5 text-slate-500" />
          </div>
          <input
            type="text"
            placeholder={`Search ${activeTab === "users" ? "users" : activeTab === "reports" ? "reports" : "feedback"}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-accent-primary/50 transition-colors"
          />
        </div>
      )}

      {activeTab === "dashboard" ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(usersLoading || reportsLoading || feedbacksLoading) ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))
            ) : (
              stats.map((stat, i) => (
                <div
                  key={i}
                  className="glass-card p-6 flex flex-col items-center text-center space-y-4"
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      stat.bg,
                    )}
                  >
                    <stat.icon className={cn("w-6 h-6", stat.color)} />
                  </div>
                  <div>
                    <div className="text-3xl font-black text-white">
                      {stat.value}
                    </div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                      {stat.label}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-accent-primary" />
                Recent Users
              </h3>
              <div className="space-y-4">
                {usersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                ) : (
                  users.slice(0, 5).map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-mystic-800 flex items-center justify-center overflow-hidden">
                          {u.photoURL ? (
                            <img
                              src={u.photoURL}
                              alt={u.displayName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User className="w-4 h-4 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {u.displayName || "Unknown"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        {u.createdAt?.toDate
                          ? u.createdAt.toDate().toLocaleDateString()
                          : "Unknown"}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-accent-primary" />
                Latest Feedback
              </h3>
              <div className="space-y-4">
                {feedbacksLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))
                ) : (
                  feedbacks.slice(0, 5).map((f) => (
                    <div
                      key={f.id}
                      className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          {f.userName || "Anonymous"}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {f.createdAt?.toDate
                            ? f.createdAt.toDate().toLocaleDateString()
                            : "Unknown"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {f.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "users" ? (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="p-4 text-sm font-bold text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {usersLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td className="p-4" colSpan={6}>
                        <Skeleton className="h-12 w-full" />
                      </td>
                    </tr>
                  ))
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-mystic-800 flex items-center justify-center overflow-hidden">
                            {u.photoURL ? (
                              <img
                                src={u.photoURL}
                                alt={u.displayName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <span className="font-medium text-white">
                            {u.displayName || "Unknown User"}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-300">{u.email}</td>
                      <td className="p-4">
                        <span className="text-xs text-slate-500">
                          {u.createdAt?.toDate
                            ? u.createdAt.toDate().toLocaleDateString()
                            : "Unknown"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-slate-500">
                          {u.lastLoginAt?.toDate
                            ? u.lastLoginAt.toDate().toLocaleString()
                            : "Never"}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-bold ${
                            u.role === "admin"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {u.role || "user"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={u.role || "user"}
                            onChange={(e) => handleRoleChange(u.id, e.target.value).catch(err => console.error("Unhandled error in handleRoleChange:", err))}
                            className="bg-mystic-900 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent-primary"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button
                            onClick={() => handleDeleteUser(u.id).catch(err => console.error("Unhandled error in handleDeleteUser:", err))}
                            className={cn(
                              "p-2 rounded-lg transition-all",
                              confirmingDelete?.id === u.id && confirmingDelete?.type === "user"
                                ? "bg-red-500 text-white"
                                : "text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                            )}
                            title="Delete User Account"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!usersLoading && filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === "reports" ? (
        <div className="space-y-4">
          {reportsLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))
          ) : (
            filteredReports.map((report) => (
              <div key={report.id} className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-mystic-800 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white">
                          {report.author || "Anonymous"}
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                          {report.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {report.timestamp?.toDate
                          ? report.timestamp.toDate().toLocaleString()
                          : "Unknown date"}{" "}
                        • ID: {report.id} • User ID: {report.userId}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      handleDeleteReport(report.id).catch(err => {
                        console.error("Report deletion failed:", err);
                      });
                    }}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete Report"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <h4 className="text-sm font-semibold text-accent-primary mb-1">
                      Scenario
                    </h4>
                    <p className="text-slate-300 whitespace-pre-wrap">
                      {report.scenario}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <h4 className="text-sm font-semibold text-accent-primary mb-1">
                      Action
                    </h4>
                    <p className="text-slate-300 whitespace-pre-wrap">
                      {report.action}
                    </p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                    <h4 className="text-sm font-semibold text-accent-primary mb-1">
                      Result
                    </h4>
                    <p className="text-slate-300 whitespace-pre-wrap">
                      {report.result}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2">
                  <span>Likes: {report.likes || 0}</span>
                  <span>Comments: {report.commentCount || 0}</span>
                </div>
              </div>
            ))
          )}
          {!reportsLoading && filteredReports.length === 0 && (
            <div className="glass-card p-12 text-center text-slate-500">
              No field reports found.
            </div>
          )}
        </div>
      ) : activeTab === "feedback" ? (
        <div className="space-y-4">
          {feedbacksLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))
          ) : (
            filteredFeedbacks.map((feedback) => (
              <div key={feedback.id} className="glass-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-mystic-800 flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-slate-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white">
                          {feedback.userName || "Anonymous"}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            feedback.type === "bug"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : feedback.type === "feature"
                                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                : feedback.type === "praise"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                  : "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                          }`}
                        >
                          {feedback.type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        {feedback.email || "No email provided"} •{" "}
                        {feedback.createdAt?.toDate
                          ? feedback.createdAt.toDate().toLocaleString()
                          : "Unknown date"}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-1">
                        ID: {feedback.id}{" "}
                        {feedback.userId ? `• User ID: ${feedback.userId}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFeedback(feedback.id).catch(err => console.error("Unhandled error in handleDeleteFeedback:", err))}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete Feedback"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p className="text-slate-300 whitespace-pre-wrap">
                    {feedback.message}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  {feedback.url && (
                    <p className="text-xs text-slate-500 break-all">
                      <span className="font-semibold">URL:</span> {feedback.url}
                    </p>
                  )}
                  {feedback.userAgent && (
                    <p className="text-xs text-slate-500 break-all">
                      <span className="font-semibold">User Agent:</span>{" "}
                      {feedback.userAgent}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
          {!feedbacksLoading && filteredFeedbacks.length === 0 && (
            <div className="glass-card p-12 text-center text-slate-500">
              No feedback found.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
