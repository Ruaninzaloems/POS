import { Component, Input, Output, EventEmitter } from '@angular/core';

export interface TabItem {
  key: string;
  label: string;
}

@Component({
  selector: 'app-tabs',
  standalone: true,
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.css'
})
export class TabsComponent {
  @Input() tabs: TabItem[] = [];
  @Input() activeTab = '';
  @Output() tabChange = new EventEmitter<string>();

  selectTab(key: string): void {
    this.tabChange.emit(key);
  }
}
