import { Component, ChangeDetectionStrategy, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
})
export class LoginComponent {
  loginSuccess = output<void>();
  private toastService = inject(ToastService);

  email = signal('');
  password = signal('');

  handleLogin(): void {
    const email = this.email().trim();
    const password = this.password().trim();

    if (!email || !password) {
      this.toastService.show('Por favor, preencha o e-mail e a senha.', 'error');
      return;
    }

    if (email === 'emanoel@esuda.edu.br' && password === '123456') {
      this.loginSuccess.emit();
      this.toastService.show('Login realizado com sucesso!', 'success');
    } else {
      this.toastService.show('E-mail ou senha inválidos.', 'error');
    }
  }

  requestAccess(): void {
    this.toastService.show('Funcionalidade de solicitação de acesso em desenvolvimento.', 'info');
  }

  forgotPassword(): void {
    this.toastService.show('Funcionalidade de recuperação de senha em desenvolvimento.', 'info');
  }
}
