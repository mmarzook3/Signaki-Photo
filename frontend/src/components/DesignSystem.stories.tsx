import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { StatusBadge, Empty, ErrorNotice } from "./common";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "./ui/dialog";
const meta = {
  title: "Signaki/Design system",
  component: Button,
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Actions: Story = {
  render: () => (
    <div className="form-stack">
      <Button>Primary action</Button>
      <Button variant="outline">Secondary action</Button>
      <Button disabled>Saving…</Button>
    </div>
  ),
};
export const ReviewStates: Story = {
  render: () => (
    <div className="form-stack">
      <StatusBadge status="pending" />
      <StatusBadge status="approved" />
      <StatusBadge status="review" />
      <StatusBadge status="rejected" />
    </div>
  ),
};
export const FormAndError: Story = {
  render: () => (
    <div className="form-stack">
      <label>
        Property name
        <Input placeholder="Example property" />
      </label>
      <ErrorNotice error="Please explain what changes are needed." />
    </div>
  ),
};
export const EmptyGallery: Story = {
  render: () => (
    <Empty
      title="Ready for photographs"
      text="Upload your first review proofs to get started."
    />
  ),
};
export const AccessibleDialog: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open review dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
          <DialogDescription>
            Explain the changes needed on this version.
          </DialogDescription>
        </DialogHeader>
        <label>
          Reason
          <Input />
        </label>
        <Button>Save</Button>
      </DialogContent>
    </Dialog>
  ),
};
