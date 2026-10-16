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
import { ReportPage } from './patient/ReportPage';
import { SurveyPage, SurveyResponsePage, SurveysPage } from './patient/SurveyPages';
import { FamilyPage } from './patient/FamilyPages';
import { JournalPage } from './patient/JournalPages';
import { HistoryPage } from './patient/HistoryPages';
import { DoctorReportPage } from './patient/DoctorReportPage';
import { HealthCalendarPage, PlanPage } from './patient/PlanPages';
import { AiCardsPage } from './shared/SystemStatus';
import { CardDetailPage, CardsPage, DocumentDetailPage, DocumentsPage, HelpPage, SafetyPage, SharingPage, TimelinePage } from './patient/MvpPages';
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
const InboxPage = lazy(() => import('./staff/VisitPages').then((m) => ({ default: m.InboxPage })));
const VisitPage = lazy(() => import('./staff/VisitPages').then((m) => ({ default: m.VisitPage })));
const SharedPatientsPage = lazy(() => import('./staff/VisitPages').then((m) => ({ default: m.SharedPatientsPage })));
const FactsPage = lazy(() => import('./staff/VisitPages').then((m) => ({ default: m.FactsPage })));
const MetricsPage = lazy(() => import('./staff/ClinicPages').then((m) => ({ default: m.MetricsPage })));
const OrgManagePage = lazy(() => import('./staff/ClinicPages').then((m) => ({ default: m.OrgManagePage })));
const StaffAccountPage = lazy(() => import('./staff/ClinicPages').then((m) => ({ default: m.StaffAccountPage })));
// strony pod linkiem (bez konta) — osobny pakiet, ładowany na telefonie pacjenta
const ModuleMapPage = lazy(() => import('./shared/ModuleMapPage').then((m) => ({ default: m.ModuleMapPage })));
const IntakeLinkPage = lazy(() => import('./link/LinkPages').then((m) => ({ default: m.IntakeLinkPage })));
const CardLinkPage = lazy(() => import('./link/LinkPages').then((m) => ({ default: m.CardLinkPage })));
const PhoneRecordPage = lazy(() => import('./link/LinkPages').then((m) => ({ default: m.PhoneRecordPage })));
const SosCardPage = lazy(() => import('./link/LinkPages').then((m) => ({ default: m.SosCardPage })));
const StaffInviteAcceptPage = lazy(() => import('./link/LinkPages').then((m) => ({ default: m.StaffInviteAcceptPage })));
const MagicLinkPage = lazy(() => import('./link/LinkPages').then((m) => ({ default: m.MagicLinkPage })));

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
      <Route path="/panel/zaproszenie/:token" element={<StaffInviteAcceptPage />} />
      <Route path="/z/:token" element={<IntakeLinkPage />} />
      <Route path="/k/:token" element={<CardLinkPage />} />
      <Route path="/nagranie/:token" element={<PhoneRecordPage />} />
      <Route path="/ratunek/:token" element={<SosCardPage />} />
      <Route path="/logowanie/link" element={<MagicLinkPage />} />
      <Route path="/moduly" element={<ModuleMapPage />} />

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
        <Route path="skrzynka" element={<InboxPage />} />
        <Route path="wizyta/:id" element={<VisitPage />} />
        <Route path="udostepnienia" element={<SharedPatientsPage />} />
        <Route path="raport/:patientId" element={<FactsPage />} />
        <Route path="mierniki" element={<MetricsPage />} />
        <Route path="organizacja" element={<AdminOnly><OrgManagePage /></AdminOnly>} />
        <Route path="konto" element={<StaffAccountPage />} />
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
        <Route path="dokumenty" element={<DocumentsPage />} />
        <Route path="dokumenty/:id" element={<DocumentDetailPage />} />
        <Route path="os-czasu" element={<TimelinePage />} />
        <Route path="raport" element={<ReportPage />} />
        <Route path="ankiety" element={<SurveysPage />} />
        <Route path="rodzina" element={<FamilyPage />} />
        <Route path="dzienniki" element={<JournalPage />} />
        <Route path="historia-zdrowia" element={<HistoryPage />} />
        <Route path="dla-lekarza" element={<DoctorReportPage />} />
        <Route path="kalendarz" element={<HealthCalendarPage />} />
        <Route path="plan" element={<PlanPage />} />
        <Route path="jak-dziala-ai" element={<AiCardsPage />} />
        <Route path="ankiety/odpowiedzi/:id" element={<SurveyResponsePage />} />
        <Route path="ankiety/:id" element={<SurveyPage />} />
        <Route path="udostepnianie" element={<SharingPage />} />
        <Route path="karty" element={<CardsPage />} />
        <Route path="karty/:id" element={<CardDetailPage />} />
        <Route path="pomoc" element={<HelpPage />} />
        <Route path="bezpieczenstwo" element={<SafetyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Suspense>
  );
}
