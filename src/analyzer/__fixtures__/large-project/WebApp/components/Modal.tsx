import { debug } from '../../Shared/logger';
export interface ModalProps { title: string; isOpen: boolean; onClose: () => void; }
export function Modal(props: ModalProps) {
  function open() { debug('Modal opened: ' + props.title); }
  function close() { props.onClose(); debug('Modal closed: ' + props.title); }
  return { open, close };
}
