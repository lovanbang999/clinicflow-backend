export interface GeneralFindings {
  status?: string;
  conclusion?: string;
}

export interface EyeFindings {
  vaRightNone?: string;
  vaLeftNone?: string;
  vaRightGlass?: string;
  vaLeftGlass?: string;
  iopRight?: string;
  iopLeft?: string;
  iopMethod?: string;
  fundusResult?: string;
  lens?: string;
  clinicalNote?: string;
  status?: string;
  conclusion?: string;
}

export interface DentalFindings {
  problemTeeth?: number[];
  clinicalNote?: string;
  gumStatus?: string;
  hygiene?: string;
  status?: string;
  conclusion?: string;
}

export interface EntFindings {
  earRight_drum?: string;
  earRight_hearing?: string;
  nose_septum?: string;
  nose_discharge?: string;
  status?: string;
  conclusion?: string;
}

export interface CardiologyFindings {
  heartSounds?: string;
  hr?: string;
  pulses?: string;
  edema?: string;
  ecgRhythm?: string;
  status?: string;
  conclusion?: string;
}

export interface DermatologyFindings {
  distribution?: string;
  lesionType?: string;
  color?: string;
  status?: string;
  conclusion?: string;
}

export interface GynecologyFindings {
  cycle?: string;
  para?: string;
  vagina?: string;
  status?: string;
  conclusion?: string;
}

export interface OrthopedicsFindings {
  location?: string;
  vas?: number | string;
  rom?: string;
  status?: string;
  conclusion?: string;
}

export interface NeurologyFindings {
  gcs?: string;
  motor?: string;
  status?: string;
  conclusion?: string;
}

export interface GastroFindings {
  wall?: string;
  liver?: string;
  spleen?: string;
  endo?: string;
  status?: string;
  conclusion?: string;
}

export interface EndoFindings {
  hba1c?: string;
  glucose?: string;
  status?: string;
  conclusion?: string;
}

export interface UrologyFindings {
  voiding?: string;
  status?: string;
  conclusion?: string;
}

export interface RespFindings {
  rr?: string;
  lungs?: string;
  status?: string;
  conclusion?: string;
}

export type SpecialistFindings =
  | GeneralFindings
  | EyeFindings
  | DentalFindings
  | EntFindings
  | CardiologyFindings
  | DermatologyFindings
  | GynecologyFindings
  | OrthopedicsFindings
  | NeurologyFindings
  | GastroFindings
  | EndoFindings
  | UrologyFindings
  | RespFindings;
