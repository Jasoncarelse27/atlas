import { render, screen } from "@testing-library/react";
import { HistoryList } from "./HistoryList";

const items = [
  { id: "1", title: "First",  pinned: false, updatedAt: new Date().toISOString() },
  { id: "2", title: "Second", pinned: true,  updatedAt: new Date().toISOString() },
];

test("renders items and calls onOpen", () => {
  const onOpen = vi.fn();
  render(<HistoryList items={items} onOpen={onOpen} />);
  expect(screen.getByText(/First/i)).toBeInTheDocument();
  expect(screen.getByText(/Second/i)).toBeInTheDocument();
});
