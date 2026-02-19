import { render, screen, fireEvent } from "@testing-library/react";
import { DetailPanel } from "./DetailPanel";
import { makeItem } from "../test/fixtures";

describe("DetailPanel", () => {
  it("shows empty state 'Select an item to see details.' when item is null", () => {
    render(<DetailPanel item={null} onMarkRead={() => {}} />);
    expect(screen.getByText("Select an item to see details.")).toBeInTheDocument();
  });

  it("renders metadata grid with STATUS, PRIORITY, and ASSIGNED rows", () => {
    const item = makeItem({
      metadata: JSON.stringify({
        status: "In Review",
        priority: "High",
        assignee: "Charlie",
      }),
    });
    render(<DetailPanel item={item} onMarkRead={() => {}} />);
    expect(screen.getByText("STATUS")).toBeInTheDocument();
    expect(screen.getByText("In Review")).toBeInTheDocument();
    expect(screen.getByText("PRIORITY")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("ASSIGNED")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("renders tags as badges", () => {
    const item = makeItem({ tags: JSON.stringify(["backend", "auth"]) });
    render(<DetailPanel item={item} onMarkRead={() => {}} />);
    expect(screen.getByText("backend")).toBeInTheDocument();
    expect(screen.getByText("auth")).toBeInTheDocument();
  });

  it("calls onMarkRead(id, true) when 'Mark read' is clicked on unread item", () => {
    const handleMarkRead = vi.fn();
    const item = makeItem({ id: "item-99", is_read: false });
    render(<DetailPanel item={item} onMarkRead={handleMarkRead} />);
    fireEvent.click(screen.getByText("Mark read"));
    expect(handleMarkRead).toHaveBeenCalledWith("item-99", true);
  });

  it("shows 'Mark unread' when is_read=true", () => {
    const item = makeItem({ is_read: true });
    render(<DetailPanel item={item} onMarkRead={() => {}} />);
    expect(screen.getByText("Mark unread")).toBeInTheDocument();
  });

  it("shows 'Open in jira' button", () => {
    const item = makeItem({ source: "jira" });
    render(<DetailPanel item={item} onMarkRead={() => {}} />);
    expect(screen.getByText("Open in jira")).toBeInTheDocument();
  });

  it("renders title and summary", () => {
    const item = makeItem({
      title: "Implement caching layer",
      summary: "Add Redis caching for API responses",
    });
    render(<DetailPanel item={item} onMarkRead={() => {}} />);
    expect(screen.getByText("Implement caching layer")).toBeInTheDocument();
    expect(screen.getByText("Add Redis caching for API responses")).toBeInTheDocument();
  });
});
