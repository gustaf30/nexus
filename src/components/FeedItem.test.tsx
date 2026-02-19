import { render, screen, fireEvent } from "@testing-library/react";
import { FeedItem } from "./FeedItem";
import { makeItem } from "../test/fixtures";

describe("FeedItem", () => {
  it("renders title, source tag [JIRA], and source_id", () => {
    const item = makeItem({ title: "Fix auth bug", source: "jira", source_id: "AUTH-42" });
    render(<FeedItem item={item} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("Fix auth bug")).toBeInTheDocument();
    expect(screen.getByText("[JIRA]")).toBeInTheDocument();
    expect(screen.getByText("AUTH-42")).toBeInTheDocument();
  });

  it("displays time-ago relative to now", () => {
    const fakeNow = 1700000000;
    vi.spyOn(Date, "now").mockReturnValue(fakeNow * 1000); // Date.now returns ms
    // item.timestamp is in unix seconds; 2h = 7200s before fakeNow
    const item = makeItem({ timestamp: fakeNow - 7200 });
    render(<FeedItem item={item} isSelected={false} onClick={() => {}} />);
    expect(screen.getByText("2h ago")).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it("fires onClick when clicked", () => {
    const handleClick = vi.fn();
    const item = makeItem();
    render(<FeedItem item={item} isSelected={false} onClick={handleClick} />);
    fireEvent.click(screen.getByText(item.title));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies opacity 0.55 when is_read=true", () => {
    const item = makeItem({ is_read: true });
    const { container } = render(
      <FeedItem item={item} isSelected={false} onClick={() => {}} />
    );
    const feedItemEl = container.querySelector(".feed-item") as HTMLElement;
    expect(feedItemEl.style.opacity).toBe("0.55");
  });

  it("shows priority badge for medium+ urgency, hides for low", () => {
    // High priority -> "high" urgency -> badge visible
    const highItem = makeItem({
      id: "high",
      metadata: JSON.stringify({ priority: "High" }),
    });
    const { container: c1 } = render(
      <FeedItem item={highItem} isSelected={false} onClick={() => {}} />
    );
    expect(c1.querySelector(".urgency-badge")).toBeInTheDocument();

    // Low priority -> "low" urgency -> no badge
    const lowItem = makeItem({
      id: "low",
      metadata: JSON.stringify({ priority: "Low" }),
    });
    const { container: c2 } = render(
      <FeedItem item={lowItem} isSelected={false} onClick={() => {}} />
    );
    expect(c2.querySelector(".urgency-badge")).not.toBeInTheDocument();
  });
});
