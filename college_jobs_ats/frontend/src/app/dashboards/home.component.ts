import { Component } from '@angular/core';

@Component({
  standalone: true,
  template: `
    <div class="page">
      <h1>Dashboard</h1>
      <div class="card">Select a module from the sidebar.</div>
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; margin: auto; }
    .card { background: white; padding: 25px; border-radius: 14px; margin-top: 20px; }
  `]
})
export class HomeComponent {}
