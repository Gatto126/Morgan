import React from "react";
import { CircleUserRound } from "lucide-react";

type Props = React.ComponentProps<typeof CircleUserRound>;

export default function UserIcon(props: Props) {
  return <CircleUserRound {...props} />;
}
