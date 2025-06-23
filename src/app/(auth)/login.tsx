import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { TextInput, Button, Checkbox } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [manterConectado, setManterConectado] = useState(false);

  const handleLogin = () => {
    // Aqui você pode colocar sua lógica de autenticação
    console.log({ email, senha, manterConectado });
    router.push('/(tabs)/home');
  };

  const handleEsqueciSenha = () => {
    console.log('Redirecionar para recuperação de senha');
    // router.push('/recuperar-senha'); // Se tiver uma tela de recuperação
  };

  const handleCadastro = () => {
    console.log('Redirecionar para cadastro');
    router.push('/(auth)/cadastro');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Faça seu login</Text>

      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        mode="flat"
        underlineColor="transparent"
        placeholder="Email"
        placeholderTextColor="#ccc"
      />

      <TextInput
        label="Senha"
        value={senha}
        onChangeText={setSenha}
        style={styles.input}
        mode="flat"
        underlineColor="transparent"
        secureTextEntry
        placeholder="Senha"
        placeholderTextColor="#ccc"
      />

      <View style={styles.row}> 
        <View style={styles.checkboxContainer}>
          <View style={styles.checkbox}>
            <Checkbox
                status={manterConectado ? 'checked' : 'unchecked'}
                onPress={() => setManterConectado(!manterConectado)}
            />
          </View>
          <Text>Continuar conectado</Text>
        </View>

        <TouchableOpacity onPress={handleEsqueciSenha}>
          <Text style={styles.linkText}>Esqueci a senha</Text>
        </TouchableOpacity>
      </View>

      <Button
        mode="contained"
        onPress={handleLogin}
        style={styles.loginButton}
        contentStyle={{ height: 50 }}
      >
        Entrar
      </Button>

      <TouchableOpacity onPress={handleCadastro}>
        <Text style={styles.cadastroText}>Não tenho conta</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#f9f8f6',
    borderRadius: 25,
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    alignItems: 'center',
    borderStyle: 'solid',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  linkText: {
    color: '#f68c1f',
    fontSize: 14,
  },
  loginButton: {
    borderRadius: 25,
    backgroundColor: '#f68c1f',
    marginBottom: 20,
  },
  cadastroText: {
    color: '#f68c1f',
    textAlign: 'center',
    fontSize: 14,
  },
});