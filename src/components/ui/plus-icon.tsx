import React from "react";
import { CirclePlus } from "lucide-react";

type Props = React.ComponentProps<typeof CirclePlus>;

export default function PlusIcon(props: Props) {
  return <CirclePlus {...props} />;
}
