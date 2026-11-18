import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { EarlyAccessForm } from "@/components/marketing/early-access-form";

function fill() {
  fireEvent.change(screen.getByLabelText("Full name"), {
    target: { value: "Alex Morgan" },
  });
  fireEvent.change(screen.getByLabelText("Work email"), {
    target: { value: "alex@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Company"), {
    target: { value: "Example Foods" },
  });
  fireEvent.change(screen.getByLabelText("Role or job title"), {
    target: { value: "CI Manager" },
  });
  fireEvent.change(screen.getByLabelText("Number of sites"), {
    target: { value: "4" },
  });
  fireEvent.change(screen.getByLabelText("Number of employees"), {
    target: { value: "50–249" },
  });
  fireEvent.click(screen.getByLabelText("5S audits"));
  fireEvent.click(screen.getByLabelText(/I agree to the/));
}

describe("Get free access form", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("labels every field and leaves both consent ticks unticked", () => {
    render(<EarlyAccessForm />);
    const sites = screen.getByLabelText("Number of sites");
    expect(sites).toHaveAttribute("inputmode", "numeric");
    expect(sites).toHaveAttribute("placeholder", "e.g. 3");
    expect(sites).toHaveAttribute("type", "text");
    expect(screen.getByLabelText(/I agree to the/)).not.toBeChecked();
    expect(screen.getByLabelText(/product news and updates/)).not.toBeChecked();
    expect(screen.getAllByRole("link", { name: "Terms" })[0]).toHaveAttribute(
      "href",
      "/terms",
    );
    expect(
      screen.getAllByRole("link", { name: "Privacy Policy" })[0],
    ).toHaveAttribute("href", "/privacy");
    expect(
      screen.getByRole("group", { name: "Which CI areas interest you?" }),
    ).toBeInTheDocument();
  });

  it("shows inline errors on submit and does not post", () => {
    render(<EarlyAccessForm />);
    fireEvent.click(screen.getByRole("button", { name: "Get free access" }));
    expect(screen.getByText("Enter your full name.")).toBeVisible();
    expect(screen.getByText("Enter the number of sites.")).toBeVisible();
    expect(screen.getByText("Choose at least one CI area.")).toBeVisible();
    expect(screen.getByText("Please tick the box to continue.")).toBeVisible();
    const name = screen.getByLabelText("Full name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name.getAttribute("aria-describedby")).toBeTruthy();
    expect(name).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts JSON and shows the success state", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<EarlyAccessForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Get free access" }));

    await screen.findByRole("heading", {
      name: "Thanks. We have your details.",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/early-access");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      fullName: "Alex Morgan",
      sites: "4",
      employees: "50–249",
      ciAreas: ["5S audits"],
      consent: true,
      marketingOptIn: false,
      website: "",
    });
    expect(screen.getByRole("link", { name: "Book a demo" })).toHaveAttribute(
      "href",
      "/demo",
    );
  });

  it("explains a not-configured backend in friendly words", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: "not_configured", message: "Not on yet." }),
        { status: 503 },
      ),
    );
    render(<EarlyAccessForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Get free access" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Not on yet."),
    );
  });

  it("shows the generic error when the network fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<EarlyAccessForm />);
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Get free access" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong. Please try again.",
      ),
    );
  });
});
