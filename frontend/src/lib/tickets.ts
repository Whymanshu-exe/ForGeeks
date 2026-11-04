import { initialTickets } from "./mockData";
import type { Ticket, TicketStatus } from "../types";

const storageKey = "gfg-rbu-demo-tickets";

function readTickets(): Ticket[] {
  const saved = localStorage.getItem(storageKey);
  if (!saved) {
    localStorage.setItem(storageKey, JSON.stringify(initialTickets));
    return initialTickets;
  }
  try {
    return JSON.parse(saved) as Ticket[];
  } catch (error) {
    throw new Error("Saved demo tickets are invalid. Clear the GFG RBU demo data from this browser to reset it.", { cause: error });
  }
}

function saveTickets(tickets: Ticket[]) {
  localStorage.setItem(storageKey, JSON.stringify(tickets));
  window.dispatchEvent(new Event("gfg-tickets-updated"));
}

export async function getTickets(): Promise<Ticket[]> {
  return readTickets();
}

export function subscribeTicketStorageUpdates(onUpdate: () => void) {
  window.addEventListener("gfg-tickets-updated", onUpdate);
  return () => window.removeEventListener("gfg-tickets-updated", onUpdate);
}

export async function createTicket(
  input: Pick<Ticket, "title" | "domain" | "priority" | "description">,
) {
  const tickets = readTickets();
  const latestNumber = Math.max(
    142,
    ...tickets.map((ticket) => Number(ticket.id.split("-")[1]) || 0),
  );
  const nextTicket: Ticket = {
    ...input,
    id: `GFG-${latestNumber + 1}`,
    status: "Open",
    assignee: "Unassigned",
    initials: "?",
    createdAt: new Date().toISOString().slice(0, 10),
    labels: [],
    comments: [],
  };
  saveTickets([nextTicket, ...tickets]);
  return nextTicket;
}

export async function updateTicketStatus(id: string, status: TicketStatus) {
  const tickets = readTickets();
  const nextTickets = tickets.map((ticket) =>
    ticket.id === id ? { ...ticket, status } : ticket,
  );
  saveTickets(nextTickets);
  return nextTickets.find((ticket) => ticket.id === id);
}

export async function updateTicketAssignee(id: string, assignee: string, initials: string) {
  const tickets = readTickets();
  const nextTickets = tickets.map((ticket) =>
    ticket.id === id ? { ...ticket, assignee, initials } : ticket,
  );
  saveTickets(nextTickets);
  return nextTickets.find((ticket) => ticket.id === id);
}

export async function addTicketComment(id: string, body: string) {
  const tickets = readTickets();
  const nextTickets = tickets.map((ticket) =>
    ticket.id === id
      ? {
          ...ticket,
          comments: [
            ...ticket.comments,
            {
              author: "Alex Morgan",
              initials: "AM",
              body,
              createdAt: "Just now",
            },
          ],
        }
      : ticket,
  );
  saveTickets(nextTickets);
  return nextTickets.find((ticket) => ticket.id === id);
}
