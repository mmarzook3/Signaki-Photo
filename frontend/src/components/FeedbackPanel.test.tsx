import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusBadge, ErrorNotice } from "./common";
describe("review state presentation", () => {
  it("communicates status without relying on colour", () => {
    render(<StatusBadge status="review" />);
    expect(screen.getByText("Changes needed")).toBeVisible();
  });
  it("announces a save failure", () => {
    render(<ErrorNotice error="Your comment was not saved." />);
    expect(screen.getByRole("alert")).toHaveTextContent("not saved");
  });
});
