import { Navigate, Route, Routes } from 'react-router-dom';
import { ChangePasswordPage, ForgotPasswordPage, LoginPage, MfaPage, RegisterPage, ResetPasswordPage, VerifyEmailPage } from './auth/AuthPages';
import { NfzPage, NotificationsPage, PrivacyPage, ProfilePage } from './patient/AccountPages';
import { AppointmentDetailPage, AppointmentsPage, QuestionnairePage, TelePage } from './patient/AppointmentPages';
import { BookingPage } from './patient/BookingPage';
import { MeasurementsPage, MedicationsPage } from './patient/HealthPages';
import { HomePage } from './patient/HomePage';
import { MessagesPage, ThreadPage } from './patient/MessagePages';
import { MorePage, PatientShell } from './patient/PatientShell';
import { RecordDetailPage, RecordsPage } from './patient/RecordPages';
import { lazy, Suspense } from 'react';
import { hasRole, useSession } from './session';
import { Spinner } from './ui';

// Panel placówki ładowany osobno — aplikacja pacjenta na telefonie nie pobiera jego kodu.
const StaffShell = lazy(() => import('./staff/StaffShell').then((m) => ({ default: m.StaffShell })));
const StaffDashboardPage = lazy(() => import('./staff/DashboardPage').then((m) => ({ default: m.StaffDashboardPage })));
const CalendarPage = lazy(() => import('./staff/CalendarPage').then((m) => ({ default: m.CalendarPage })));
const PatientsPage = lazy(() => import('./staff/PatientPages').then((m) => ({ default: m.PatientsPage })));
const PatientDetailPage = lazy(() => import('./staff/PatientPages').then((m) => ({ default: m.PatientDetailPage })));
const StaffMessagesPage = lazy(() => import('./staff/OrgPages').then((m) => ({ default: m.StaffMessagesPage })));
const SchedulePage = lazy(() => import('./staff/OrgPages').then((m) => ({ default: m.SchedulePage })));
const OutboxPage = lazy(() => import('./staff/OrgPages').then((m) => ({ default: m.OutboxPage })));
const AdminPage = lazy(() => import('./staff/OrgPages').then((m) => ({ default: m.AdminPage })));

function AdminOnly({ children }: { children: React.ReactElement }) {
  const { me } = useSession();
  return hasRole(me, 'admin') ? children : <Navigate to="/panel" replace />;
}

export function App() {
  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      <Route path="/logowanie" element={<LoginPage />} />
      <Route path="/rejestracja" element={<RegisterPage />} />
      <Route path="/zapomniane-haslo" element={<ForgotPasswordPage />} />
      <Route path="/reset-hasla" element={<ResetPasswordPage />} />
      <Route path="/potwierdz-email" element={<VerifyEmailPage />} />
      <Route path="/mfa" element={<MfaPage />} />
      <Route path="/panel/logowanie" element={<LoginPage staff />} />
      <Route path="/panel/mfa" element={<MfaPage staff />} />
      <Route path="/panel/zmiana-hasla" element={<ChangePasswordPage forced />} />

      <Route path="/panel" element={<StaffShell />}>
        <Route index element={<StaffDashboardPage />} />
        <Route path="kalendarz" element={<CalendarPage />} />
        <Route path="pacjenci" element={<PatientsPage />} />
        <Route path="pacjenci/:id" element={<PatientDetailPage />} />
        <Route path="wiadomosci" element={<StaffMessagesPage />} />
        <Route path="wiadomosci/:id" element={<StaffMessagesPage />} />
        <Route path="grafik" element={<SchedulePage />} />
        <Route path="wysylka" element={<OutboxPage />} />
        <Route path="powiadomienia" element={<NotificationsPage staff />} />
        <Route path="admin" element={<AdminOnly><AdminPage /></AdminOnly>} />
        <Route path="*" element={<Navigate to="/panel" replace />} />
      </Route>

      <Route path="/" element={<PatientShell />}>
        <Route index element={<HomePage />} />
        <Route path="rezerwacja" element={<BookingPage />} />
        <Route path="wizyty" element={<AppointmentsPage />} />
        <Route path="wizyty/:id" element={<AppointmentDetailPage />} />
        <Route path="wizyty/:id/wywiad" element={<QuestionnairePage />} />
        <Route path="wizyty/:id/teleporada" element={<TelePage />} />
        <Route path="wyniki" element={<RecordsPage />} />
        <Route path="wyniki/:kind/:id" element={<RecordDetailPage />} />
        <Route path="wiadomosci" element={<MessagesPage />} />
        <Route path="wiadomosci/:id" element={<ThreadPage />} />
        <Route path="pomiary" element={<MeasurementsPage />} />
        <Route path="leki" element={<MedicationsPage />} />
        <Route path="prywatnosc" element={<PrivacyPage />} />
        <Route path="profil" element={<ProfilePage />} />
        <Route path="powiadomienia" element={<NotificationsPage />} />
        <Route path="nfz" element={<NfzPage />} />
        <Route path="wiecej" element={<MorePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
