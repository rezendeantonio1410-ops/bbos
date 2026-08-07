export type CurrentUser = {
  id: string;
  name: string;
  initials: string;
  corporateTitle: string;
  systemRole: "ADMIN" | "EXECUTIVE" | "INDUSTRIAL" | "FINANCE" | "SALES";
};

/** Mock de sessão única; a autenticação real poderá substituí-lo sem alterar os componentes. */
export const currentUser: CurrentUser = {
  id: "user-jose-rezende",
  name: "José Rezende",
  initials: "JR",
  corporateTitle: "Sócio Administrador",
  systemRole: "ADMIN",
};

export const availableUsers: CurrentUser[] = [
  currentUser,
  { id: "user-suzi-ninov", name: "Suzi Ninov", initials: "SN", corporateTitle: "Sócia Administradora", systemRole: "ADMIN" },
];
