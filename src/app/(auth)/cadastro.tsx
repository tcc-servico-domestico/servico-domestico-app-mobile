import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';

export default function CadastroScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const handleCadastro = () => {
    // Lógica de cadastro
    console.log({ email, senha });

    // Após cadastro, navegar para as tabs ou para login
  };

  const handleVoltarLogin = () => {
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Crie sua conta</Text>

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

      <Button
        mode="contained"
        onPress={handleCadastro}
        style={styles.cadastroButton}
        contentStyle={{ height: 50 }}
      >
        Cadastrar
      </Button>

      <TouchableOpacity onPress={handleVoltarLogin}>
        <Text style={styles.loginText}>Já tenho conta</Text>
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
  cadastroButton: {
    borderRadius: 25,
    backgroundColor: '#f68c1f',
    marginBottom: 20,
  },
  loginText: {
    color: '#f68c1f',
    textAlign: 'center',
    fontSize: 14,
  },
});
