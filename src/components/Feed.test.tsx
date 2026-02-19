import { render, screen } from "@testing-library/react";
import { Feed } from "./Feed";
import { makeItem } from "../test/fixtures";

const noop = () => {};

describe("Feed", () => {
  it("renders 6 skeleton divs when loading=true and items=[]", () => {
    const { container } = render(
      <Feed items={[]} loading={true} error={null} selectedId={null} onSelect={noop} />
    );
    const skeletons = container.querySelectorAll(".skeleton");
    expect(skeletons).toHaveLength(6);
  });

  it("renders items when loaded", () => {
    const items = [
      makeItem({ id: "1", title: "First issue" }),
      makeItem({ id: "2", title: "Second issue" }),
    ];
    render(
      <Feed items={items} loading={false} error={null} selectedId={null} onSelect={noop} />
    );
    expect(screen.getByText("First issue")).toBeInTheDocument();
    expect(screen.getByText("Second issue")).toBeInTheDocument();
  });

  it("shows empty state 'All clear, adventurer.' when no items", () => {
    render(
      <Feed items={[]} loading={false} error={null} selectedId={null} onSelect={noop} />
    );
    expect(screen.getByText("All clear, adventurer.")).toBeInTheDocument();
  });

  it("shows error message when error is set", () => {
    render(
      <Feed items={[]} loading={false} error="Network failed" selectedId={null} onSelect={noop} />
    );
    expect(screen.getByText("Failed to load items")).toBeInTheDocument();
    expect(screen.getByText("Network failed")).toBeInTheDocument();
  });

  it("shows inline 'Refreshing...' when loading with existing items", () => {
    const items = [makeItem()];
    render(
      <Feed items={items} loading={true} error={null} selectedId={null} onSelect={noop} />
    );
    expect(screen.getByText(/Refreshing/)).toBeInTheDocument();
  });
});
