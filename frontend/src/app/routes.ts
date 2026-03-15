import { createBrowserRouter } from "react-router";
import { LoginPage } from "./components/LoginPage";
import { DoctorDashboard } from "./components/DoctorDashboard";
import { DoctorWorkspace } from "./components/DoctorWorkspace";
import { PatientDashboard } from "./components/PatientDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginPage,
  },
  {
    path: "/doctor-dashboard",
    Component: DoctorDashboard,
  },
  {
    path: "/doctor-workspace",
    Component: DoctorWorkspace,
  },
  {
    path: "/patient-dashboard",
    Component: PatientDashboard,
  },
]);